import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '@repo/shared';
import { Response, Request } from 'express';

type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  path: string;
  requestId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ERROR_CODES.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let details: Record<string, unknown> | undefined;

    // Handle different exception types
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        
        const customCode = resp.code as string;
        if (customCode in ERROR_CODES) {
             code = customCode as ErrorCode;
        } else {
             code = this.getCodeFromStatus(status);
        }
        details = resp.details as Record<string, unknown>;
      }

      if (code === ERROR_CODES.INTERNAL_ERROR) {
          code = this.getCodeFromStatus(status);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle Prisma errors
      const prismaError = this.handlePrismaError(exception);
      status = prismaError.status;
      code = prismaError.code;
      message = prismaError.message;
      details = prismaError.details;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = ERROR_CODES.VALIDATION_ERROR;
      message = 'Database validation error';
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Log the error
    const errorContext = {
      path: request.url,
      method: request.method,
      userId: (request as { user?: { id: string } }).user?.id,
      body: this.sanitizeBody(request.body),
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (status >= 500) {
      this.logger.error(`${code}: ${message}`, errorContext);
    } else {
      this.logger.warn(`${code}: ${message}`, errorContext);
    }

    // Build error response
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.headers['x-request-id'] as string,
    };

    response.status(status).json(errorResponse);
  }


  private getCodeFromStatus(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.AUTH_UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.AUTH_FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ERROR_CODES.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMIT_EXCEEDED;
      default:
        return ERROR_CODES.INTERNAL_ERROR;
    }
  }


  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  } {
    switch (error.code) {
      case 'P2002': {
        // Unique constraint violation
        const target = (error.meta?.target as string[]) || [];
        return {
          status: HttpStatus.CONFLICT,
          code: ERROR_CODES.ALREADY_EXISTS,
          message: `A record with this ${target.join(', ')} already exists`,
          details: { fields: target },
        };
      }
      case 'P2025':
        // Record not found
        return {
          status: HttpStatus.NOT_FOUND,
          code: ERROR_CODES.NOT_FOUND,
          message: 'The requested record was not found',
        };
      case 'P2003':
        // Foreign key constraint failed
        return {
          status: HttpStatus.BAD_REQUEST,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Related record not found',
        };
      case 'P2014':
        // Required relation violation
        return {
          status: HttpStatus.BAD_REQUEST,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Required relation constraint violated',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ERROR_CODES.DATABASE_ERROR,
          message: 'A database error occurred',
        };
    }
  }

  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = ['password', 'apiKey', 'token', 'secret'];
    const sanitized = { ...body } as Record<string, unknown>;

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}