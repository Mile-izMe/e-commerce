# Auth, Users và Cart hoạt động cùng nhau

Dự án dùng NestJS Controller → Service → Repository trên PostgreSQL/Prisma 8.
Auth chịu trách nhiệm đăng ký, kiểm tra mật khẩu và cấp JWT. Users quản lý hồ sơ
và địa chỉ của chính người dùng. Cart lấy danh tính đã xác minh từ JWT; không nhận
`userId` từ request body, query hoặc header.

## Luồng đăng ký, đăng nhập và truy cập dữ liệu

```mermaid
sequenceDiagram
    participant Client
    participant AuthController
    participant AuthService
    participant UsersService
    participant UserRepository
    participant Database
    Client->>AuthController: POST /auth/register {email, username, password}
    AuthController->>AuthService: register(request)
    AuthService->>AuthService: Argon2id.hash(password)
    AuthService->>UsersService: register(request, passwordHash)
    UsersService->>UserRepository: createCustomer(...)
    UserRepository->>Database: INSERT users (role=CUSTOMER)
    Database-->>UserRepository: user (không chọn passwordHash)
    AuthService->>AuthService: sign JWT {sub: user.id}
    AuthController-->>Client: {accessToken, tokenType, expiresIn, user}
    Client->>AuthController: POST /auth/login {identifier, password}
    AuthService->>UserRepository: tìm username hoặc email
    AuthService->>AuthService: Argon2id.verify(passwordHash, password)
    AuthService->>Database: kiểm tra trạng thái, ghi lastLoginAt
    AuthService-->>Client: JWT + user công khai
```

`passwordHash` chỉ được đọc trong đường đăng nhập. Mật khẩu gốc không lưu vào
database, log hoặc response. Hash Argon2id chứa salt và tham số để verify;
không cần tạo cột salt riêng. Dùng mặc định của thư viện `argon2` cho hash mới.
Không so sánh chuỗi mật khẩu với hash và không chấp nhận mật khẩu plaintext cũ.

Sau login, client gửi header `Authorization: Bearer <accessToken>`:

```mermaid
sequenceDiagram
    participant Client
    participant AuthGuard
    participant UsersService
    participant UserController
    participant CartController
    Client->>AuthGuard: GET /users/me hoặc GET /cart + Bearer token
    AuthGuard->>AuthGuard: xác minh chữ ký HS256, exp, issuer, audience, sub UUID
    AuthGuard->>UsersService: đọc role/status/deletedAt mới nhất theo sub
    UsersService-->>AuthGuard: UserProfile công khai
    AuthGuard->>UserController: request.user = UserProfile
    AuthGuard->>CartController: request.user = UserProfile
    CartController->>CartController: dùng request.user.id để chọn Cart
```

Token chỉ chứa `sub` là ID user. Quyền và trạng thái được đọc lại mỗi request,
nên suspend/delete user chặn token cũ ngay. AuthGuard trả 401 nếu thiếu hoặc
sai/hết hạn token; tài khoản `SUSPENDED` trả 403; user đã xóa trả 401.
`RolesGuard` dùng `@Roles(['ADMIN'])` cho những route admin sẽ thêm sau này.
Luôn đặt `AuthGuard` trước `RolesGuard` để request.user đã được xác minh.

## API và DTO

| Method | Endpoint                         | Body                                                                     | Kết quả                |
| ------ | -------------------------------- | ------------------------------------------------------------------------ | ---------------------- |
| POST   | `/auth/register`                 | `email`, `username`, `password`, `name?`                                 | 201, `AuthResponseDto` |
| POST   | `/auth/login`                    | `identifier` (username hoặc email), `password`                           | 200, `AuthResponseDto` |
| GET    | `/users/me`                      | Không                                                                    | Hồ sơ hiện tại         |
| PATCH  | `/users/me`                      | `name?`, `phone?`                                                        | Hồ sơ đã cập nhật      |
| GET    | `/users/me/addresses`            | Không                                                                    | Danh sách địa chỉ      |
| POST   | `/users/me/addresses`            | Tên người nhận, điện thoại, địa chỉ, thành phố; các trường khác tùy chọn | 201, địa chỉ           |
| PATCH  | `/users/me/addresses/:addressId` | Một hoặc nhiều trường địa chỉ                                            | Địa chỉ đã cập nhật    |
| DELETE | `/users/me/addresses/:addressId` | Không                                                                    | 204                    |

`AuthResponseDto` gồm `{ accessToken, tokenType: "Bearer", expiresIn: 900, user }`.
Hồ sơ và địa chỉ lấy từ repository với danh sách field rõ ràng; không trả
`passwordHash`, `deletedAt` hay `lastLoginAt`. Đăng ký chỉ tạo role `CUSTOMER`.
Admin không thể được tạo bằng cách thêm `role` vào body.

Email và username được chuyển chữ thường trước khi ghi/tìm kiếm; username dài
3–32 ký tự, chỉ chứa chữ, số và `_`. Password dài 12–128 ký tự. Việc kiểm tra
unique trước insert giúp báo lỗi rõ; unique constraint trong PostgreSQL quyết định
khi hai request đăng ký chạy cùng lúc. Body thêm field lạ bị ValidationPipe từ chối.

Địa chỉ luôn được lọc theo `userId` của token. PATCH/DELETE địa chỉ của người
khác hoặc ID không tồn tại trả 404. `countryCode` mặc định `VN` và chuẩn hóa
chữ hoa. Địa chỉ lưu để người dùng chọn; Order sau này phải lưu snapshot địa chỉ
giao hàng, không phụ thuộc địa chỉ sống có thể bị sửa/xóa.

Cart dùng cùng AuthGuard. Lấy token từ response đăng ký/đăng nhập rồi gọi
`GET /cart`, `POST /cart/items` và các route khác trong [cart.md](cart.md).

## Cấu hình và chạy local

Trong `.env`, đặt `DATABASE_URL` và `JWT_SECRET`. Secret phải có tối thiểu
32 byte UTF-8; ứng dụng từ chối khởi động nếu thiếu/yếu. Tạo một secret ngẫu nhiên:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Sau đó thêm `JWT_SECRET="<giá trị vừa tạo>"` vào `.env`. Không commit `.env`.
JWT dùng HS256, issuer `e-commerce`, audience `e-commerce-api`, hạn 15 phút.
Các instance của cùng môi trường phải dùng cùng secret. Đổi secret sẽ làm token
cũ hết hiệu lực. Dự án chưa có refresh token hoặc server-side logout; sau khi
token hết hạn, client đăng nhập lại. Để triển khai công khai, cần thêm rate limit
cho login/register và quy trình quên mật khẩu/xác minh email phù hợp sản phẩm.

```powershell
pnpm install --frozen-lockfile
pnpm run build
pnpm run start:dev
```

Không đổi Prisma contract/schema trong phần này, vì User, UserAddress và các
unique constraint đã có. Không cần migration mới. Nếu database mới, áp dụng
migration theo [prisma.md](prisma.md) trước khi chạy app.

## Cách kiểm tra

```powershell
pnpm run typecheck
pnpm run lint
pnpm run test:db:up
$env:TEST_DATABASE_URL = 'postgresql://catalog_test:catalog_test@127.0.0.1:55432/ecommerce_catalog_test'
pnpm run test:integration
pnpm run test:db:down
pnpm test --runInBand
pnpm run test:e2e
```

Integration test dùng PostgreSQL tách biệt và JWT thật, kiểm tra Argon2id,
đăng nhập, quyền sở hữu địa chỉ/Cart, token không hợp lệ, tài khoản bị khóa
và hai request đăng ký cùng lúc. Test không sử dụng database development.
