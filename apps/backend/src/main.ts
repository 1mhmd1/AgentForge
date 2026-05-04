import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' });
  app.setGlobalPrefix('api');
  await app.listen(process.env.BACKEND_PORT ?? 3000);
}

bootstrap();
