import {
  Controller,
  Get,
  Req,
  Res,
  Query,
  UseGuards,
  // BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { ApiKeyGuard, EnvironmentContext } from '../eval/guards/api-key.guard';

import { SSEService } from './sse.service';

@Controller('sse')
export class SSEController {
  constructor(private readonly sseService: SSEService) {}

  /**
   * Subscribe to flag updates via Server-Sent Events
   * GET /api/v1/sse/subscribe?apiKey=xxx
   */
  @Get('subscribe')
  @UseGuards(ApiKeyGuard)
  async subscribe(
    @Req() req: express.Request,
    @Res() res: express.Response,
    @Query('lastEventId') lastEventId?: string,
  ) {
    const env = req.environment as EnvironmentContext;
    const connectionId = uuidv4();

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Parse last event ID for reconnection
    const lastId = lastEventId ? parseInt(lastEventId, 10) : undefined;

    // Add connection
    const result = await this.sseService.addConnection(
      connectionId,
      env.projectId,
      env.id,
      res,
      lastId,
    );

    if (!result.success) {
      res.status(503).end(JSON.stringify({ error: result.error }));
      return;
    }

    // Send initial comment to establish connection
    res.write(': connected\n\n');
  }

  /**
   * Get SSE connection statistics
   * GET /api/v1/sse/stats
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  getStats() {
    return this.sseService.getStats();
  }
}
