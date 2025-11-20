import { Controller, Get } from '@nestjs/common';

@Controller('api/v1/eval/health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api-read',
    };
  }
}
