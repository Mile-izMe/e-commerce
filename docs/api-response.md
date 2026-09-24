# Quy ước response API

Tất cả endpoint trả body thành công dùng một envelope:

```json
{
  "success": true,
  "message": "Products retrieved",
  "data": [],
  "timestamp": "2026-09-24T08:00:00.000Z",
  "meta": {
    "nextCursor": null,
    "hasMore": false,
    "limit": 20
  }
}
```

`meta` chỉ có ở danh sách dùng cursor. Các endpoint 204 (logout, xóa địa chỉ)
giữ body rỗng. HTTP status vẫn có ý nghĩa: 201 khi tạo, 200 khi đọc/cập nhật.
`SuccessResponseInterceptor` bọc response tập trung, controller chỉ trả dữ liệu
nghiệp vụ. `SuccessMessage` đặt thông điệp riêng cho route.

Lỗi dùng cùng một dạng:

```json
{
  "success": false,
  "timestamp": "2026-09-24T08:00:00.000Z",
  "statusCode": 400,
  "error": "Bad Request",
  "errorCode": "SYS-400",
  "message": "Input not valid!",
  "traceId": "f4d8a1b6-2390-45fe-939e-21e1a539a50f",
  "subErrors": [{ "field": "limit", "message": "limit must not be greater than 100" }]
}
```

`GlobalExceptionFilter` xử lý `AppException`, lỗi HTTP/validation của NestJS
và lỗi hệ thống. Lỗi không xác định chỉ trả thông báo 500 chung; stack trace
ở server log. Header `x-trace-id` trong response hỗ trợ đối chiếu log.

## Cursor pagination

DTO chung `CursorPaginationQueryDto` nhận `limit` (mặc định 20, tối đa 100)
và `cursor`. Hàm `paginateCursor` lấy `limit + 1` dòng để xác định
`hasMore`; không cần truy vấn `COUNT(*)`. Catalog thêm bộ lọc `category`
và dùng cặp `createdAt, id` làm khóa sắp xếp. Cursor là chuỗi opaque:
client chỉ lưu rồi gửi lại, không tự tạo hoặc sửa. Dùng cursor của category
khác bị từ chối.
