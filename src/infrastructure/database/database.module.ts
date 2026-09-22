import { Inject, Injectable, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createDatabase } from '../../prisma/db.js';
import type { DatabaseClient } from '../../prisma/db.js';
import { DATABASE } from './database.constants.js';

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.database.close();
  }
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DatabaseClient =>
        createDatabase(config.getOrThrow<string>('DATABASE_URL')),
    },
    DatabaseLifecycle,
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
