import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private publisher?: Redis;
  private subscriber?: Redis;
  private redisAdapter?: ReturnType<typeof createAdapter>;

  async connectToRedis(
    url: string,
    key = 'ecommerce:socket.io',
  ): Promise<void> {
    // Hai connection riêng: một publish, một subscribe broadcast từ node khác.
    this.publisher = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 5000,
    });
    this.subscriber = this.publisher.duplicate();
    this.publisher.on('error', () =>
      this.logger.warn('Redis publisher unavailable'),
    );
    this.subscriber.on('error', () =>
      this.logger.warn('Redis subscriber unavailable'),
    );
    try {
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
      this.redisAdapter = createAdapter(this.publisher, this.subscriber, {
        key,
      });
    } catch {
      this.disconnectRedis();
      // Không log URL vì có thể chứa password. Không âm thầm chạy local khi cấu hình Redis lỗi.
      throw new Error(
        'Cannot connect chat Redis adapter. Check CHAT_REDIS_URL.',
      );
    }
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    if (!this.redisAdapter)
      throw new Error('Redis adapter must connect before listening');
    const server = super.createIOServer(port, options) as Server;
    server.adapter(this.redisAdapter);
    return server;
  }

  async dispose(): Promise<void> {
    try {
      await super.dispose();
    } finally {
      this.disconnectRedis();
    }
  }

  private disconnectRedis(): void {
    this.publisher?.disconnect();
    this.subscriber?.disconnect();
  }
}
