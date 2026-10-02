# Discord lab trong BE e-commerce

## Lựa chọn adapter

Dùng `IoAdapter` mặc định khi không có `CHAT_REDIS_URL`; khi có biến này, bootstrap gắn `RedisIoAdapter` để broadcast xuyên instance. Xem [Redis adapter lab](./redis-adapter-lab.md). Không cần đổi Gateway handlers
hay mở thêm server/port. `ChatGateway` được đăng ký trong `MessagingModule`,
module được import vào `AppModule`; Nest tự gắn Socket.IO vào HTTP server.

Namespace `/chat` phân chia event logic. Transport endpoint vẫn là `/socket.io`.
Socket.IO có protocol riêng: FE dùng `socket.io-client`, không dùng `new WebSocket()`.

- Một instance: adapter in-memory mặc định hiện tại đủ dùng.
- Nhiều instance: bổ sung Socket.IO Redis adapter để broadcast giữa các node.
  Nếu giữ HTTP polling, load balancer còn cần sticky sessions; Redis không thay thế điều này.
- Native WebSocket (`WsAdapter`): phù hợp khi muốn tự xây rooms, reconnect và ack.
  Chưa cần cho mốc lab đầu tiên.

Tham khảo: [NestJS adapters](https://docs.nestjs.com/v11/websockets/adapter),
[Socket.IO middleware](https://socket.io/docs/v4/middlewares/).

## Schema và migration

`Guild.owner` liên kết User; `GuildMember` có khóa chính `(userId, guildId)`;
`Channel` liên kết Guild và tên không trùng trong một guild;
`Message` có ID server, author/channel relations, timestamp và client-generated ID.

`(authorId, clientMessageId)` là unique constraint. Hai socket gửi đồng thời cùng
key và payload chỉ lưu một record. Nếu key cũ dùng với channel/content khác,
server trả `CONFLICT`. Content được trim trước khi so sánh/lưu.

Tạo guild và owner membership chạy cùng transaction.
Xóa guild ở database sẽ cascade channels, members và messages.
Quan hệ owner/author/member với User dùng Restrict để giữ lịch sử.
Hiện chưa có endpoint xóa guild, sửa/xóa message hoặc remove member.

Migration `20261001T0726_add_messaging_lab` đã thêm bốn bảng, FK và indexes;
không reset database. Artifacts được sinh từ `src/prisma/contract.prisma`.

## Từng lớp làm gì?

```text
HTTP Controller ─┐
                 ├─ MessagingService ─ MessagingRepository ─ PostgreSQL
Socket Gateway ──┘
```

- Controller: tạo guild/channel, thêm thành viên và lấy lịch sử qua HTTP.
- Gateway: handshake, rooms, event handlers và broadcast.
- Service: quyền owner/member, kiểm tra channel và cursor history.
- Repository: truy vấn, transaction, xử lý unique constraint khi retry.
- AccessTokenService: verify JWT dùng chung cho HTTP AuthGuard và socket handshake.
- WsAuthGuard: kiểm tra expiry và user vẫn ACTIVE trước mỗi event.
- ChatExceptionFilter: lỗi validation/quyền/DB thành ack hoặc `chat.error`.

Interceptor success của HTTP bỏ qua WS để không bọc ack lần nữa.
Gateway có ValidationPipe riêng để validate DTO của các socket events.
Gateway filter chuyển HTTP exceptions từ service/pipe thành lỗi WS.
Module chạy thực tế là `src/modules/messaging`.

## Xác thực socket

FE gửi `auth: { token: accessToken }`. Middleware xác thực trước khi connection
được chấp nhận và gắn `socket.data.user`, `expiresAt` từ JWT.
Author ID luôn lấy từ user đã xác thực; payload không được chứa `authorId`.
`channel.join` và `message.send` kiểm tra GuildMember trong database.

Token hết hạn: server emit `chat.error` với `AUTH_EXPIRED`, rồi disconnect.
FE phải refresh bằng hàm refresh session hiện có, cập nhật `socket.auth`, gọi
`socket.connect()` và join lại rooms. Axios interceptor 401 không xử lý socket.
Chỉ refresh khi lỗi auth và giới hạn retry; lỗi quyền không được refresh vô hạn.
Logout/account switch trên FE phải disconnect socket và xóa dữ liệu chat cũ.
Access token hiện tại vẫn có hiệu lực đến expiry khi logout chỉ revoke refresh token,
giống chính sách HTTP hiện tại; chưa có broadcast revoke session tới sockets.
Account status được kiểm tra khi connect/gửi event; chưa có cơ chế đẩy thay đổi
status hoặc membership tới các socket đang nhận broadcast.

## HTTP APIs

Các endpoints cần Bearer token và dùng success/error envelope chung của BE.

| Method | Endpoint                                                 | Quyền / payload                                |
| ------ | -------------------------------------------------------- | ---------------------------------------------- |
| POST   | `/chat/guilds`                                           | User đăng nhập; `{ name, description? }`       |
| GET    | `/chat/guilds`                                           | Guild mà user là thành viên                    |
| POST   | `/chat/guilds/:guildId/members`                          | Owner; `{ userId }` của user ACTIVE đã tồn tại |
| POST   | `/chat/guilds/:guildId/channels`                         | Owner; `{ name, description? }`                |
| GET    | `/chat/guilds/:guildId/channels`                         | Guild member                                   |
| GET    | `/chat/channels/:channelId/messages?limit=20&cursor=...` | Guild member                                   |

History trả mới nhất trước, cursor theo `(createdAt DESC, id DESC)`, limit 1–100.
Cursor chứa channelId để không tái sử dụng cho channel khác.
FE đảo thứ tự khi hiển thị chat, dùng cursor để tải tin cũ hơn.
Tạo guild, thêm tài khoản thứ hai bằng userId, tạo channel trước khi test sockets.
HTTP APIs có trong Swagger `/api`, event contract mô tả dưới đây.

## Socket events và ack

| Event gửi lên   | Payload                                   | Kết quả                                  |
| --------------- | ----------------------------------------- | ---------------------------------------- |
| `channel.join`  | `{ channelId }`                           | Kiểm tra quyền, join room `channel:<id>` |
| `channel.leave` | `{ channelId }`                           | Leave room                               |
| `message.send`  | `{ channelId, clientMessageId, content }` | Lưu, broadcast, trả Message              |

Ack success: `{ success: true, data: ... }`.
Ack error: `{ success: false, error: { code, message } }`.
Nếu client không gửi callback ack, lỗi được emit qua `chat.error`.
Event server `message.created` chứa Message trực tiếp.
`connect_error` chứa chi tiết ở `error.data` (`AUTH_INVALID`, `FORBIDDEN`, `INTERNAL_ERROR`).
Content dài 1–2000 ký tự sau trim; không nhận field lạ.
Giới hạn payload transport 32KB và tối đa 30 lần gửi/10 giây mỗi connection.
Đây là giới hạn basic in-memory, reconnect có thể reset và không thay thế
rate limiting theo user/IP khi public hệ thống.

## Ví dụ client tối thiểu

Trong FE: `pnpm add socket.io-client`. Chạy đoạn này trong client component/hook.
Kết nối trực tiếp BE; không giả định rewrite HTTP `/backend` của Next xử lý WS.

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001/chat', {
  auth: { token: accessToken },
  transports: ['websocket'],
  autoConnect: false,
});

socket.on('message.created', (message) => {
  // Upsert theo message.id: ack và broadcast có thể cùng chứa tin vừa gửi.
});
socket.on('chat.error', (response) => console.log(response.error));
socket.on('connect_error', (error) => console.log(error.data));
socket.on('connect', async () => {
  const result = await socket
    .timeout(5000)
    .emitWithAck('channel.join', { channelId });
  if (!result.success) return;
  // Sau khi join, tải history để bù tin bị bỏ lỡ; merge theo message.id.
});
socket.connect();

const outgoing = {
  channelId,
  clientMessageId: crypto.randomUUID(),
  content: 'Hello architecture lab',
};
const result = await socket.timeout(5000).emitWithAck('message.send', outgoing);
// Timeout không có nghĩa là DB chưa lưu. Retry phải dùng lại outgoing/key này.
// Unmount/logout: socket.disconnect(), remove listeners trong cleanup.
```

`CHAT_ALLOWED_ORIGINS` trong `.env` là danh sách origin FE, phân cách dấu phẩy;
mặc định `http://localhost:3000`. Khi FE chạy port khác cần thêm origin đó.
Origin kiểm tra cả polling CORS và WebSocket upgrade. Client Node không có Origin
vẫn phải xác thực JWT và quyền truy cập như client browser.

## Delivery guarantee và bài học tiếp theo

DB lưu xong mới broadcast. Retry cùng key trả cùng Message và không broadcast lại.
Nếu process chết sau commit trước emit, Message vẫn có trong history nhưng
người online có thể không nhận event. Hiện chưa có Outbox/Kafka/delivery receipts.
Khi reconnect, join room trước rồi fetch history; deduplicate theo message.id.
Để phục hồi đầy đủ một khoảng mất kết nối dài, cần page history đến ID đã biết
hoặc bổ sung endpoint catch-up theo cursor; một page mới nhất chưa đủ mọi trường hợp.

Bước sau: transactional outbox → worker → Kafka; Redis adapter khi chạy nhiều
gateway replicas. Kafka cùng consumer group phân chia công việc, không tự
broadcast một event cho mọi instance đang giữ rooms.

## Kiểm thử

```powershell
pnpm run test:db:up
$env:TEST_DATABASE_URL='postgresql://catalog_test:catalog_test@127.0.0.1:55432/ecommerce_catalog_test'
pnpm run test:integration -- --testPathPatterns=messaging
```

Test dùng PostgreSQL riêng (`_test`) và server/socket thật: handshake JWT,
owner/member permissions, validation, rooms, persistence, concurrent retry,
cursor history, account suspension, token expiry và rate limiting.

## Flow hiện tại:

FE emit message.send
→ Gateway BE nhận, xác thực và kiểm tra quyền
→ Service/Repository lưu tin vào DB
→ Gateway emit message.created tới room của channel
→ FE nhận, cập nhật state/cache
→ React render tin nhắn

- Typing:
  FE emit typing.activity / typing.stop
  → BE xác thực và kiểm tra quyền
  → broadcast typing.changed tới những socket khác trong room
  → FE cập nhật danh sách typing và TTL
  → React render indicator

