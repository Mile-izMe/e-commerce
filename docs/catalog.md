# Catalog: chạy và kiểm tra

Catalog dùng NestJS Controller → Service → Repository → Prisma 8. `DatabaseModule`
cấp một client dùng chung qua token `DATABASE`; lifecycle provider đóng pool khi
ứng dụng shutdown. `createDatabase()` tạo client riêng cho seed và integration test.

## Chạy local

Yêu cầu: Node.js hỗ trợ Prisma 8 (dự án đã kiểm chứng với Node 25.9), pnpm,
PostgreSQL 15+ và `DATABASE_URL` trong `.env`. Dùng các phiên bản đã khóa trong
`pnpm-lock.yaml`.

```powershell
pnpm install --frozen-lockfile
pnpm exec prisma db verify
pnpm run seed
pnpm run start:dev
```

`db verify` chỉ kiểm tra schema. Nếu database chưa có schema, làm theo quy trình
migration trong `docs/prisma.md` trước khi seed; không reset database có dữ liệu.

Seed tạo 3 category, 10 product, 10 SKU, inventory ban đầu 50/SKU, stock ledger
và ảnh placeholder. Tất cả slug/SKU mẫu có tiền tố `demo-`/`DEMO-`.
Seed chạy trong một transaction, chỉ tạo dữ liệu còn thiếu; lần chạy sau không
đặt lại giá, trạng thái hay tồn kho đã thay đổi. Chạy một tiến trình seed mỗi lần.
Không chạy seed demo với `NODE_ENV=production`.

Chạy bản build:

```powershell
pnpm run build
pnpm run start:prod
```

Build sinh lại Prisma contract và xuất ESM vào `dist/`; các local import trong
TypeScript dùng đuôi `.js` để Node chạy trực tiếp code đã biên dịch.

## API

```powershell
curl.exe "http://localhost:3000/products?page=1&limit=5"
curl.exe "http://localhost:3000/products?category=demo-clothing"
curl.exe "http://localhost:3000/products/demo-cotton-t-shirt"
```

### GET /products

| Query      | Mặc định | Giới hạn                        |
| ---------- | -------- | ------------------------------- |
| `page`     | 1        | Số nguyên 1–10000               |
| `limit`    | 20       | Số nguyên 1–100                 |
| `category` | Tất cả   | Category slug, tối đa 120 ký tự |

Response: `{ data: Product[], meta: { page, limit, total, totalPages } }`.
Sắp xếp theo `createdAt DESC, id ASC`; ID làm thứ tự phụ khi trùng thời gian.
Category không tồn tại hoặc page vượt giới hạn dữ liệu trả `data: []`.
Query không hợp lệ hoặc tham số không được hỗ trợ trả HTTP 400.

Sản phẩm chỉ xuất hiện khi `status = ACTIVE`, `archivedAt = null` và có ít nhất
một variant đang active, chưa archived. Sản phẩm hết tồn kho vẫn được hiển thị
với `availableQuantity = 0`. Lọc category dùng slug, không dùng ID.
Thuộc tính `Category.isActive` hiện chưa quyết định visibility của sản phẩm;
trạng thái bán được quản lý bằng Product/Variant.

### GET /products/:slug

Trả chi tiết với category, ảnh theo `position` và các variant hợp lệ theo SKU.
Sản phẩm không tồn tại, draft, archived hoặc không có variant hợp lệ trả 404.
Slug không đúng định dạng trả 400.

Giá tiền là **chuỗi số nguyên theo đơn vị tiền nhỏ nhất**, ví dụ
`"priceAmount": "199000", "currency": "VND"`. Không convert BigInt thành Number
vì có thể mất chính xác. `compareAtAmount` có thể là null.

`availableQuantity = max(0, onHand - reserved)` chỉ phục vụ hiển thị. Checkout
phải đọc/giữ hàng bằng transaction, không tin số lượng từ response Catalog.
API dùng response DTO rõ ràng, không trả trực tiếp ORM record hoặc cột nội bộ.

Tổng số và dữ liệu trang là hai truy vấn; khi có cập nhật đồng thời chúng có thể
lệch nhẹ. Đây là API browse catalog, chưa cung cấp snapshot pagination.

## Kiểm tra

```powershell
pnpm run typecheck
pnpm run lint
pnpm test --runInBand
pnpm run test:e2e
```

Integration tests chạy toàn bộ Nest pipeline và repository trên PostgreSQL thật.
Mặc định không dùng `DATABASE_URL` làm test database. Khởi tạo database tạm riêng:

```powershell
pnpm run test:db:up
$env:TEST_DATABASE_URL = "postgresql://catalog_test:catalog_test@127.0.0.1:55432/ecommerce_catalog_test"
pnpm run test:integration
pnpm run test:db:down
```

Container test chỉ bind localhost:55432 và dùng tmpfs. `test:db:down` xóa dữ liệu
tạm trong container test; không tác động container/database development.
Test tự áp dụng các migration đã commit vào database test, tạo fixture riêng,
dọn fixture theo ID và đóng client sau khi hoàn tất. Dữ liệu demo từ bài test
seed tồn tại đến khi container test được tắt.

Nếu dùng test database riêng khác, tên database phải kết thúc bằng `_test` và
phải khác database development. Không trỏ `TEST_DATABASE_URL` vào dữ liệu thật.

Các tình huống được kiểm tra: phân trang ổn định, tổng theo category, page rỗng,
lọc draft/archived và variant ẩn, 404, validation query, thứ tự ảnh, tính tồn khả dụng,
giá tiền vượt `Number.MAX_SAFE_INTEGER`, seed lặp lại và giữ nguyên tồn kho.
