import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  // Fotos de escaneo (base64) desde la app móvil
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.enableCors({
    origin: config.get('CORS_ORIGIN', '*') === '*' ? true : config.get('CORS_ORIGIN'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = parseInt(config.get('PORT', '3000'), 10);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🃏 API TCG escuchando en http://localhost:${port}/api`);
}
bootstrap();
