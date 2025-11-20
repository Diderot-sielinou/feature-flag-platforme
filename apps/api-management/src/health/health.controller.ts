import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get() // Répond à GET /
  check() {
    // Retourne un statut 200 OK et un message simple
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api-management',
    };
  }
}
