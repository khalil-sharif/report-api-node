import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });
  const config = app.get(ConfigService);
  const prefix = config.get<string>('apiPrefix') ?? 'api/v1';

  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Report Generation API')
    .setDescription('Dynamic PDF/Excel/CSV report generation with templates, scheduling, caching.')
    .setVersion('1.0')
    .addTag('reports')
    .addTag('templates')
    .addTag('schedules')
    .addTag('dashboard')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}/${prefix}  (docs at /docs)`);
}

bootstrap();
