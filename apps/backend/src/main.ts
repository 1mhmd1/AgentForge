import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import {
  ClassSerializerInterceptor,
  Logger,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3000;
  const corsOrigins = config.get<string[]>('corsOrigins') ?? [
    'http://localhost:5173',
  ];
  const nodeEnv = config.get<string>('nodeEnv') ?? 'development';

  // Per-request id (correlation across logs / metrics / OpenTelemetry).
  app.use((req: any, res: any, next: any) => {
    const incoming = req.headers['x-request-id']?.toString();
    req.id = incoming && incoming.length <= 128 ? incoming : `req_${randomUUID()}`;
    res.setHeader('x-request-id', req.id);
    next();
  });

  app.use(cookieParser());
  app.use(
    helmet({
      // SSE responses set their own headers; CSP isn't useful for a JSON API.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Global /api prefix; health + metrics live on the bare URL so external
  // probes don't have to know about the prefix.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.ALL },
      { path: 'health/(.*)', method: RequestMethod.ALL },
      { path: 'metrics', method: RequestMethod.ALL },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const reflector = app.get(Reflector);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ClassSerializerInterceptor(reflector),
    new ResponseInterceptor(reflector),
  );

  // OpenAPI / Swagger
  const swagger = new DocumentBuilder()
    .setTitle('AgentForge API')
    .setDescription('NestJS backend for AgentForge orchestration platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('token')
    .addServer(`http://localhost:${port}`)
    .build();

  const swaggerDoc = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api/docs', app, swaggerDoc, {
    swaggerOptions: { persistAuthorization: true },
  });

  app.enableShutdownHooks();

  await app.listen(port);
  Logger.log(
    `AgentForge backend listening on http://localhost:${port}/api (env=${nodeEnv})`,
    'Bootstrap',
  );
  Logger.log(`Swagger UI: http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('FATAL boot error:', err);
  process.exit(1);
});
