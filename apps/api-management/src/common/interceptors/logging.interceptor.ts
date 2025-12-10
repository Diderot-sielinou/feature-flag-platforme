/* eslint-disable @typescript-eslint/no-explicit-any */
// src/common/interceptors/logging.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable , throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

/**
 * HTTP Request/Response Logging Interceptor
 * 
 * Features:
 * - Structured JSON logging with correlation IDs
 * - Request/response timing with slow request warnings
 * - Automatic sensitive data redaction
 * - Error logging with full context
 * - CloudWatch-compatible log format
 * 
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  // Threshold for slow request warnings (1 second)
  private readonly SLOW_REQUEST_THRESHOLD_MS = 1000;

  // Sensitive fields to redact from logs
  private readonly SENSITIVE_FIELDS = [
    'password',
    'apiKey',
    'api_key',
    'token',
    'secret',
    'authorization',
    'cookie',
    'sessionId',
    'jwt',
    'bearerToken',
  ] as const;

  /**
   * Intercepts HTTP requests to add structured logging
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const startTime = Date.now();
    const requestId = this.extractOrGenerateRequestId(request);
    const metadata = this.buildRequestMetadata(request, requestId);

    // Log incoming request
    this.logRequest(metadata);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logResponse(metadata, response.statusCode, duration);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logError(metadata, error, duration);
        return throwError(() => error);
      }),
    );
  }

  /**
   * Extracts request ID from headers or generates a new one
   */
  private extractOrGenerateRequestId(request: Request): string {
    return (
      (request.headers['x-request-id'] as string) ||
      (request.headers['x-correlation-id'] as string) ||
      this.generateRequestId()
    );
  }

  /**
   * Generates a unique request ID with timestamp and random component
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 11);
    return `req_${timestamp}_${randomPart}`;
  }

  /**
   * Builds structured metadata for logging
   */
  private buildRequestMetadata(request: Request, requestId: string) {
    const userId = (request as any).user?.id || (request as any).user?.sub || 'anonymous';
    
    return {
      requestId,
      method: request.method,
      url: request.url,
      path: request.path,
      userId,
      ip: request.ip || request.socket.remoteAddress,
      userAgent: request.get('user-agent') || 'unknown',
      // Extract organization context if available (for multi-tenant)
      organizationId: (request as any).user?.organizationId,
    };
  }

  /**
   * Logs incoming HTTP request
   */
  private logRequest(metadata: ReturnType<typeof this.buildRequestMetadata>): void {
    const { requestId, method, url, userId, ip } = metadata;

    this.logger.log({
      message: 'Incoming request',
      requestId,
      method,
      url,
      userId,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Logs successful HTTP response
   */
  private logResponse(
    metadata: ReturnType<typeof this.buildRequestMetadata>,
    statusCode: number,
    duration: number,
  ): void {
    const { requestId, method, url } = metadata;

    const logData = {
      message: 'Request completed',
      requestId,
      method,
      url,
      statusCode,
      duration,
      timestamp: new Date().toISOString(),
    };

    // Warn on slow requests for performance monitoring
    if (duration > this.SLOW_REQUEST_THRESHOLD_MS) {
      this.logger.warn({
        ...logData,
        message: 'Slow request detected',
        threshold: this.SLOW_REQUEST_THRESHOLD_MS,
      });
    } else {
      this.logger.log(logData);
    }
  }

  /**
   * Logs HTTP errors with full context
   */
  private logError(
    metadata: ReturnType<typeof this.buildRequestMetadata>,
    error: Error,
    duration: number,
  ): void {
    const { requestId, method, url, userId } = metadata;

    this.logger.error({
      message: 'Request failed',
      requestId,
      method,
      url,
      userId,
      duration,
      error: {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Sanitizes request body by redacting sensitive fields
   * Used only in development mode
   */
  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return body;
    }

    const sanitized = { ...body } as Record<string, unknown>;

    for (const field of this.SENSITIVE_FIELDS) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeBody(value);
      }
    }

    return sanitized;
  }
}