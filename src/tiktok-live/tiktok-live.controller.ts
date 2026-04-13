import { Controller, Get, Param, Query, HttpException, HttpStatus, Res, Sse } from '@nestjs/common';
import type { Response } from 'express';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { TikTokLiveService } from './tiktok-live.service';
import { TikTokRealtimeService } from './tiktok-realtime.service';
import { TikTokCacheService } from './tiktok-cache.service';

@Controller('tiktok')
export class TikTokLiveController {
  constructor(
    private readonly tiktokLiveService: TikTokLiveService,
    private readonly realtimeService: TikTokRealtimeService,
    private readonly cacheService: TikTokCacheService,
  ) {}

  /**
   * Get live viewer count for a TikTok user
   * @param username TikTok username (query param or path param)
   */
  @Get('viewers')
  async getViewers(@Query('username') username: string) {
    if (!username || username.trim() === '') {
      throw new HttpException(
        'Username is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Remove @ if present
    const cleanUsername = username.replace(/^@/, '');

    try {
      const result = await this.tiktokLiveService.getViewerCount(cleanUsername);

      if (result.error) {
        throw new HttpException(
          {
            message: result.error,
            username: cleanUsername,
            viewerCount: 0,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          message: error.message || 'Failed to get viewer count',
          username: cleanUsername,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get detailed room info for a TikTok user
   * @param username TikTok username
   */
  @Get('room-info')
  async getRoomInfo(@Query('username') username: string) {
    if (!username || username.trim() === '') {
      throw new HttpException(
        'Username is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const cleanUsername = username.replace(/^@/, '');

    try {
      const result = await this.tiktokLiveService.getRoomInfo(cleanUsername);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          message: error.message || 'Failed to get room info',
          username: cleanUsername,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Server-Sent Events: Stream de viewers en tiempo real
   * Mantiene la conexión abierta y envía actualizaciones cada 5 segundos
   * 
   * GET /tiktok/stream?username=USER
   */
  @Sse('stream')
  streamViewers(@Query('username') username: string, @Res() res: Response) {
    if (!username || username.trim() === '') {
      res.statusCode = 400;
      res.end();
      return;
    }

    const cleanUsername = username.replace(/^@/, '');

    // Configurar headers de SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Crear stream que obtiene viewers cada 5 segundos
    return interval(5000).pipe(
      map(async (i) => {
        try {
          const result = await this.tiktokLiveService.getViewerCount(cleanUsername);
          return {
            data: JSON.stringify({
              username: cleanUsername,
              viewerCount: result.viewerCount,
              isLive: result.isLive,
              timestamp: result.timestamp,
              sequenceNumber: i,
            }),
          };
        } catch (error) {
          return {
            data: JSON.stringify({
              username: cleanUsername,
              viewerCount: 0,
              isLive: false,
              error: error.message,
              timestamp: new Date(),
              sequenceNumber: i,
            }),
          };
        }
      }),
    );
  }

  /**
   * Server-Sent Events: Tiempo Real SIN Rate Limit
   * 
   * Conecta UNA SOLA VEZ al iniciar y reutiliza los datos en caché
   * Evita hacer múltiples conexiones que cause rate limiting
   * 
   * GET /tiktok/live?username=USER
   */
  @Get('live')
  async streamLive(@Query('username') username: string, @Res() res: Response) {
    if (!username || username.trim() === '') {
      throw new HttpException(
        'Username is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const cleanUsername = username.replace(/^@/, '');

    // Configurar headers de SSE
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Enviar comentario inicial
    res.write(': conectado a viewers en tiempo real (datos en caché cada 5s)\n\n');

    let updateCount = 0;

    // PASO 1: Conectar UNA SOLA VEZ al inicio
    await this.cacheService.startMonitoring(cleanUsername);

    const sendUpdate = () => {
      try {
        // PASO 2: Obtener del caché (NO crear nueva conexión)
        const cached = this.cacheService.getFromCache(cleanUsername);

        if (cached) {
          const message = {
            type: 'viewers_update',
            username: cleanUsername,
            viewerCount: cached.viewerCount,
            isLive: cached.isLive,
            timestamp: new Date(), // Timestamp actual
            updateNumber: ++updateCount,
            cached: true,
          };

          res.write(`data: ${JSON.stringify(message)}\n\n`);
        }
      } catch (error) {
        const errorMessage = {
          type: 'error',
          username: cleanUsername,
          error: error.message,
          timestamp: new Date(),
        };
        res.write(`data: ${JSON.stringify(errorMessage)}\n\n`);
      }
    };

    // Enviar datos del caché cada 5 segundos (SIN crear nuevas conexiones)
    const interval = setInterval(sendUpdate, 5000);

    // Enviar primera actualización inmediatamente
    sendUpdate();

    // Limpiar cuando se cierre la conexión
    res.on('close', () => {
      clearInterval(interval);
      this.cacheService.stopMonitoring(cleanUsername);
      res.end();
    });

    res.on('error', () => {
      clearInterval(interval);
      this.cacheService.stopMonitoring(cleanUsername);
      res.end();
    });
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'TikTok Live Viewers',
    };
  }

  /**
   * Get info about currently streamed viewers
   */
  @Get('monitoring-stats')
  getMonitoringStats() {
    return {
      monitored: this.realtimeService.getMonitoredStreamers(),
      totalMonitored: this.realtimeService.getMonitoredStreamers().length,
    };
  }
}
