import { Controller, Get } from '@nestjs/common';

@Controller('eval/health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string; service: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api-read',
    };
  }

  @Get('/force')
  force(): { status: string; timestamp: string; service: string } {
    return {
      status: 'change done üüüüüüü',
      timestamp: new Date().toISOString(),
      service: 'api-read force',
    };
  }
}
