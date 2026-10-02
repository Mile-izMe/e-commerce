import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // Một instance không bắt buộc dùng Redis. Các instance trong cùng cluster phải dùng cùng URL/key.
  // const redisUrl = process.env.CHAT_REDIS_URL?.trim();
  // if (redisUrl) {
  //   const adapter = new RedisIoAdapter(app);
  //   try {
  //     await adapter.connectToRedis(redisUrl, process.env.CHAT_REDIS_KEY);
  //     app.useWebSocketAdapter(adapter);
  //   } catch (error) {
  //     await app.close();
  //     throw error;
  //   }
  // }

  const config = new DocumentBuilder()
    .setTitle('E-Commerce API')
    .setDescription('E-Commerce API with NestJS')
    .setVersion('1.0')
    .addTag('E-Commerce')
    .addBearerAuth()
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 3001);
  console.log(
    'Swagger UI: http://localhost:' + (process.env.PORT ?? 3001) + '/api',
  );
}
bootstrap();
