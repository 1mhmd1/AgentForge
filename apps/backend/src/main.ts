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

// Node 25.x has a known regression in the HTTP module's socket teardown
// (ERR_INTERNAL_ASSERTION in ServerResponse.detachSocket) that crashes the
// process AFTER the response has already been sent. Swallow it so the server
// stays up; the actual response was fine.
process.on('uncaughtException', (err: any) => {
  if (err?.code === 'ERR_INTERNAL_ASSERTION' && /detachSocket/.test(err?.stack ?? '')) {
    Logger.warn(
      `Suppressed Node ${process.version} HTTP teardown assertion: ${err.message}`,
      'Bootstrap',
    );
    return;
  }
  throw err;
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3000;
  const corsOrigins =
  process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()) || [
    'http://localhost:5173',
    'https://agent-forge-frontend-ruby.vercel.app',
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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

  // Node 25 has a regression in the HTTP keep-alive socket teardown path
  // (`ERR_INTERNAL_ASSERTION` in `ServerResponse.detachSocket`) that
  // occasionally aborts responses mid-flight on a reused connection. Until
  // Node ships a fix, force every response to close its socket so each
  // request gets a fresh one. Cost: a small per-request connect overhead;
  // worth it for stability.
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('Connection', 'close');
    next();
  });

  await app.listen(port);

  const httpServer: any = app.getHttpServer();
  if (httpServer) {
    httpServer.keepAliveTimeout = 0;
    httpServer.headersTimeout = 10_000;
  }
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
