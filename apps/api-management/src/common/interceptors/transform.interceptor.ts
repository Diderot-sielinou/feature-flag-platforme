import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data is already in our response format, return as-is
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Check if data contains pagination info
        if (data && typeof data === 'object' && 'items' in data && 'meta' in data) {
          return {
            success: true,
            data: data.items,
            meta: data.meta,
            timestamp: new Date().toISOString(),
          };
        }

        // Wrap in standard response format
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
