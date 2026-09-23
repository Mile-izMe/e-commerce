# Cart: API, repository và cách kiểm tra

Cart dùng Controller → Service → Repository. Một user có một Cart; mỗi variant
chỉ có một CartItem trong giỏ nhờ unique `(cartId, variantId)`.

## API

| Method | Path                  | Body                                       | Ý nghĩa                             |
| ------ | --------------------- | ------------------------------------------ | ----------------------------------- |
| GET    | `/cart`               | Không                                      | Đọc giỏ, không tự tạo record        |
| POST   | `/cart/items`         | `{ "variantId": "<uuid>", "quantity": 2 }` | Cộng thêm số lượng; tạo giỏ khi cần |
| PATCH  | `/cart/items/:itemId` | `{ "quantity": 3 }`                        | Đặt số lượng thành 3                |
| DELETE | `/cart/items/:itemId` | Không                                      | Xóa item thuộc giỏ của user         |
| DELETE | `/cart/items`         | Không                                      | Xóa tất cả item, giữ lại Cart       |

Các thao tác thành công trả HTTP 200 và toàn bộ `CartResponseDto`.
Giỏ chưa tồn tại trả `{ "id": null, "version": 0, "totalQuantity": 0, "items": [] }`.
`itemId` trên URL là ID CartItem, khác `variantId` trong body khi thêm.
Request DTO và response DTO được hiển thị trong Swagger `/api`.

## Danh tính người dùng

Dự án chưa triển khai đăng nhập hoặc xác thực JWT/session. CartUserGuard **chỉ kiểm tra
danh tính đã có**, không phải bộ xác thực token. Tất cả Cart endpoint trả 401 cho đến
khi middleware hoặc guard xác thực đáng tin cậy gắn `request.user = { id: userId }`.
Nếu dùng JWT guard, nó phải xác minh chữ ký, thời hạn và chạy trước CartUserGuard;
map subject đã xác thực sang `user.id`. Không chỉ decode JWT rồi tin payload.

Không nhận userId/cartId từ body, query hay header để chọn giỏ. Các field ngoài DTO
trong body bị từ chối. User không tồn tại/đã xóa mềm trả 401; user không ACTIVE trả 403. PATCH/DELETE item không thuộc giỏ hiện tại trả 404.

Integration test có middleware xác thực giả chỉ tồn tại trong file test, dùng token
ngẫu nhiên map đến fixture user. Không có đường tắt xác thực trong application.

## Quy tắc nghiệp vụ

- Mỗi item có số lượng nguyên 1–99, tối đa 100 variant khác nhau/giỏ. POST kiểm tra
  cả số lượng sau khi cộng; PATCH đặt giá trị tuyệt đối. Xóa dùng DELETE, không dùng quantity=0.
- Thêm/đổi số lượng kiểm tra Product ACTIVE, không archived và variant active,
  không archived. Không tồn tại trả 404; ngừng bán/thiếu tồn kho trả 409.
- Tồn khả dụng là `max(0, onHand - reserved)`. Thiếu Inventory được coi là hết hàng.
- Add to cart **không giữ hoặc trừ kho**, không tạo InventoryReservation/Movement.
  Checkout phải kiểm tra lại giá, trạng thái và giữ kho bằng thao tác nguyên tử.
  Kiểm tra tồn kho ở Cart chỉ phản ánh thời điểm đọc, không bảo đảm hàng còn lúc checkout.
- GET vẫn trả item đã ngừng bán/hết hàng với `purchasable: false` để người dùng xóa.
  Ảnh đại diện lấy theo position nhỏ nhất. Giá đọc từ variant hiện tại, không lưu snapshot vào CartItem.
- Giá tiền được tính bằng bigint và trả chuỗi, không ép Number. Không cộng chung
  các currency thành một tổng tiền; mỗi dòng có currency riêng.
- `version` tăng một lần mỗi thay đổi thành công. GET, PATCH cùng số lượng,
  clear giỏ rỗng và request thất bại không tăng version. Version là số revision,
  hiện chưa phải điều kiện `If-Match`: hai PATCH đồng thời dùng lần ghi cuối theo thứ tự khóa.
- POST cộng số lượng không idempotent: gửi lại một request thành công sẽ cộng tiếp.
  Client không tự retry POST khi chưa có cơ chế idempotency key.

## Repository đã sửa

Trước đây `findCartByUserId()` vừa đọc vừa tạo Cart; `findItemInCart()` vừa đọc vừa
tạo/cộng item; `updateCartVersion()` đọc rồi ghi riêng. Hai request có thể cùng thấy
giỏ chưa tồn tại hoặc cùng đọc số lượng cũ, dẫn đến unique conflict/mất cập nhật.
Các bước riêng lẻ cũng có thể để lại item đã đổi nhưng version chưa tăng.

Hiện `findCart()` chỉ đọc. Service chạy thao tác ghi trong `withUserLock()`;
repository mở transaction và dùng SQL có parameter `SELECT ... FOR UPDATE`
trên row User. Khóa parent này tồn tại ngay cả khi user chưa có Cart, nên cả việc
tạo Cart lần đầu lẫn cập nhật sau đó đều được tuần tự hóa theo user, kể cả nhiều
instance application. Các user khác nhau khóa các row khác nhau.

`CartTransaction` cung cấp các thao tác DB dùng cùng transaction: đọc giỏ, đọc
variant, tạo/cập nhật/xóa item và cập nhật version. Service giữ kiểm tra nghiệp vụ.
Exception trong callback rollback mọi thay đổi. Response của mutation được đọc
trong transaction trước commit để version và item thống nhất với thao tác đó.

Mọi writer tương lai, đặc biệt checkout, phải dùng cùng thứ tự khóa User → Cart/items
trước khi sửa giỏ. Khóa này cũng có thể chặn cập nhật cùng user trong lúc transaction
chạy, vì vậy không gọi network/payment gateway bên trong callback.

Truy vấn giỏ select đúng field, include variant → product/images + inventory, giữ
cả sản phẩm ngừng bán. Clear dùng SQL delete theo cartId để xóa toàn bộ item.
Import runtime dùng đường dẫn tương đối với `.js` để chạy được bản build ESM;
không dùng alias đang trỏ về thư mục source.

Không đổi database schema, không cần migration mới cho phần Cart.

## Kiểm tra

```powershell
pnpm run typecheck
pnpm run lint
pnpm run test:db:up
$env:TEST_DATABASE_URL = 'postgresql://catalog_test:catalog_test@127.0.0.1:55432/ecommerce_catalog_test'
pnpm run test:integration --testPathPatterns=cart.integration-spec.ts
pnpm run test:db:down
pnpm run build
```

Database test riêng dùng PostgreSQL thật; test tự áp dụng migration đã có và từ
chối URL database không có hậu tố `_test` hoặc trùng database development.
Fixture được xóa khi kết thúc. Không dùng database development để chạy suite này.
