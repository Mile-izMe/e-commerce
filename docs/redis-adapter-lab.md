# Redis adapter lab

Adapter ở `src/infrastructure/websocket/redis-io.adapter.ts`, bật trong `src/main.ts`.
Không cần đổi Gateway handlers hoặc code join room ở FE.

## Luồng

```text
Client A -> BE 1 -> lưu Message vào PostgreSQL
                 -> emit vào room channel
                 -> Redis Pub/Sub -> BE 2 -> socket B trong cùng room
```

Typing cũng được broadcast giữa các instance. Redis adapter không lưu tin, danh sách
room toàn cục hay lịch sử event; mỗi BE giữ socket/room local. PostgreSQL lưu lịch sử.
Redis gián đoạn có thể làm mất broadcast giữa node; FE tải lại lịch sử sau reconnect.
Chưa có Kafka/outbox trong bước này.

## Chạy Redis

```powershell
docker compose -p ecommerce-chat-lab -f compose.chat.yml up -d --wait
```

Redis lab bind localhost:56379, không dùng volume và không bật persistence.
Đặt trong hai terminal BE, giữ nguyên DATABASE_URL/JWT_SECRET trong .env:

```powershell
$env:CHAT_REDIS_URL = 'redis://127.0.0.1:56379'
$env:CHAT_REDIS_KEY = 'ecommerce:socket.io'
$env:PORT = '3001'
pnpm start:dev
```

Terminal BE thứ hai dùng cấu hình giống trên nhưng PORT=3002. Cả hai dùng cùng DB,
JWT_SECRET, Redis URL/key và CHAT_ALLOWED_ORIGINS.
Không để một instance bật Redis và instance kia dùng in-memory.
Nếu CHAT_REDIS_URL có giá trị mà Redis không kết nối được, BE báo lỗi khởi động.

## Hai FE để thấy rõ hai BE

Terminal FE A:

```powershell
$env:NEXT_PUBLIC_API_URL = 'http://localhost:3001'
$env:NEXT_PUBLIC_CHAT_URL = 'http://localhost:3001'
pnpm dev --port 3000
```

Terminal FE B:

```powershell
$env:NEXT_PUBLIC_API_URL = 'http://localhost:3002'
$env:NEXT_PUBLIC_CHAT_URL = 'http://localhost:3002'
pnpm dev --port 3003
```

Kiểm tra tên biến HTTP trong `.env.example` của FE trước khi dùng; nếu API client
có tên khác, giữ biến HTTP hiện tại và chỉ đổi NEXT_PUBLIC_CHAT_URL.
Trên hai BE đặt CHAT_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3003.
Dùng hai browser profile khác nhau để không chia sẻ phiên đăng nhập qua localStorage.
Cùng guild/channel: A gửi tin và typing, B phải nhận được dù nối vào BE khác.
FE hiện dùng transports: ['websocket']; nếu sau này bật polling sau load balancer,
cần sticky sessions bên cạnh adapter.

## Kiểm thử adapter không ghi DB

```powershell
$env:CHAT_REDIS_TEST_URL = 'redis://127.0.0.1:56379'
pnpm exec tsx test/redis-adapter-smoke.ts
```

Test tạo hai Socket.IO server cổng ngẫu nhiên, mỗi client nối vào một server.
Xác nhận message/typing xuyên node, đúng room, và sender bị loại với socket.to().

Dừng Redis lab:

```powershell
docker compose -p ecommerce-chat-lab -f compose.chat.yml down
```

Tham khảo: https://docs.nestjs.com/websockets/adapter và
https://socket.io/docs/v4/redis-adapter/.
