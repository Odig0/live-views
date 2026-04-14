import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { TikTokLiveService } from './tiktok-live.service';
import { TikTokCacheService } from './tiktok-cache.service';
import { ViewersCacheService } from '../viewers-cache/viewers-cache.service';

@Controller('api/v1/tiktok')
export class TikTokLiveController {
  constructor(
    private readonly tiktokLiveService: TikTokLiveService,
    private readonly cacheService: TikTokCacheService,
    private readonly viewersCacheService: ViewersCacheService,
  ) {}

  /**
   * Get live viewer count for a TikTok user
   * @param username TikTok username (query param or path param)
   */
  @Get('viewers')
  async getViewers(@Query('username') username: string) {
    if (!username || username.trim() === '') {
      throw new HttpException('Username is required', HttpStatus.BAD_REQUEST);
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

      await this.viewersCacheService.upsertTikTok({
        username: cleanUsername,
        viewerCount: result.viewerCount,
        isLive: result.isLive,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          message: getErrorMessage(error, 'Failed to get viewer count'),
          username: cleanUsername,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Server-Sent Events: Tiempo Real SIN Rate Limit
    *
   * Conecta UNA SOLA VEZ al iniciar y reutiliza los datos en caché
   * Evita hacer múltiples conexiones que cause rate limiting
    *
   * GET /api/v1/tiktok/live?username=USER
   */
  @Get('live')
  async streamLive(@Query('username') username: string, @Res() res: Response) {
    if (!username || username.trim() === '') {
      throw new HttpException('Username is required', HttpStatus.BAD_REQUEST);
    }

    const cleanUsername = username.replace(/^@/, '');

    // Configurar headers de SSE
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Enviar comentario inicial
    res.write(
      ': conectado a viewers en tiempo real (datos en caché cada 5s)\n\n',
    );

    let updateCount = 0;

    // PASO 1: Conectar UNA SOLA VEZ al inicio
    await this.cacheService.startMonitoring(cleanUsername);

    const sendUpdate = () => {
      try {
        // PASO 2: Obtener del caché (NO crear nueva conexión)
        const cached = this.cacheService.getFromCache(cleanUsername);

        if (cached) {
          void this.viewersCacheService.upsertTikTok({
            username: cleanUsername,
            viewerCount: cached.viewerCount,
            isLive: cached.isLive,
          });

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
          error: getErrorMessage(error, 'Failed to stream viewers'),
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
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
