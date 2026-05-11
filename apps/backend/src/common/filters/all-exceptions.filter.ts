import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

interface ErrorBody {
  success: false;
  message: string;
  errorCode: string;
  statusCode: number;
  path: string;
  timestamp: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.toBody(exception, request);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method} ${request.url}] ${body.errorCode}: ${body.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${request.method} ${request.url}] ${body.errorCode}: ${body.message}`,
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, request: Request): ErrorBody {
    const base = {
      success: false as const,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : (res as any)?.message ?? exception.message;
      const errorCode =
        (res as any)?.errorCode ??
        this.statusToCode(status) ??
        'HTTP_EXCEPTION';

      return {
        ...base,
        statusCode: status,
        message: Array.isArray(message) ? message.join(', ') : String(message),
        errorCode,
        details: typeof res === 'object' ? (res as any)?.details : undefined,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception, base);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        ...base,
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'PRISMA_VALIDATION',
        message: 'Invalid data submitted',
      };
    }

    return {
      ...base,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_ERROR',
      message:
        exception instanceof Error ? exception.message : 'Unexpected error',
    };
  }

  private fromPrisma(
    err: Prisma.PrismaClientKnownRequestError,
    base: { success: false; path: string; timestamp: string },
  ): ErrorBody {
    switch (err.code) {
      case 'P2002':
        return {
          ...base,
          statusCode: HttpStatus.CONFLICT,
          errorCode: 'UNIQUE_CONSTRAINT',
          message: `Resource already exists: ${(err.meta as any)?.target}`,
        };
      case 'P2025':
        return {
          ...base,
          statusCode: HttpStatus.NOT_FOUND,
          errorCode: 'NOT_FOUND',
          message: 'Resource not found',
        };
      case 'P2003':
        return {
          ...base,
          statusCode: HttpStatus.BAD_REQUEST,
          errorCode: 'FOREIGN_KEY_VIOLATION',
          message: 'Referenced resource does not exist',
        };
      default:
        return {
          ...base,
          statusCode: HttpStatus.BAD_REQUEST,
          errorCode: `PRISMA_${err.code}`,
          message: err.message.split('\n').pop() ?? 'Database error',
        };
    }
  }

  private statusToCode(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'UNPROCESSABLE_ENTITY';
      case 429:
        return 'TOO_MANY_REQUESTS';
      default:
        return status >= 500 ? 'INTERNAL_ERROR' : 'HTTP_EXCEPTION';
    }
  }
}
