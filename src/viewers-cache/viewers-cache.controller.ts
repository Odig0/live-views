import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ViewersCacheService } from './viewers-cache.service';

@Controller('api/v1/viewers-cache')
export class ViewersCacheController {
  constructor(private readonly viewersCacheService: ViewersCacheService) {}

  @Get()
  async getAll(): Promise<{ success: boolean; data: unknown }> {
    return {
      success: true,
      data: await this.viewersCacheService.readSnapshot(),
    };
  }

  @Get('tiktok')
  async getTikTok(): Promise<{ success: boolean; data: unknown }> {
    return {
      success: true,
      data: await this.viewersCacheService.readTikTokSnapshot(),
    };
  }

  @Get('youtube/snapshot')
  async getYoutubeSnapshot(): Promise<{ success: boolean; data: unknown }> {
    return {
      success: true,
      data: await this.viewersCacheService.readYoutubeSnapshot(),
    };
  }

  /**
   * Server-Sent Events: Streaming de viewers de YouTube
   * GET /api/v1/viewers-cache/youtube
   */
  @Get('youtube')
  async streamYoutubeDefault(@Res() res: Response) {
    // Configurar headers de SSE
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Enviar comentario inicial
    res.write(': conectado a viewers de YouTube en tiempo real\n\n');

    let updateCount = 0;

    const sendUpdate = async () => {
      try {
        const youtubeData =
          await this.viewersCacheService.readYoutubeSnapshot();

        const message = {
          type: 'youtube_viewers_update',
          data: youtubeData,
          updateNumber: ++updateCount,
          timestamp: new Date(),
        };

        res.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch (error) {
        const errorMessage = {
          type: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date(),
        };
        res.write(`data: ${JSON.stringify(errorMessage)}\n\n`);
      }
    };

    // Enviar primera actualización inmediatamente
    await sendUpdate();

    // Enviar actualización cada 5 segundos
    const interval = setInterval(async () => {
      await sendUpdate();
    }, 5000);

    // Limpiar cuando se cierre la conexión
    res.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  }

  @Get('facebook')
  async getFacebook(): Promise<{ success: boolean; data: unknown }> {
    return {
      success: true,
      data: await this.viewersCacheService.readFacebookSnapshot(),
    };
  }

  /**
   * Server-Sent Events: Streaming de TODOS los viewers (TikTok + YouTube)
   * GET /api/v1/viewers-cache/stream
   */
  @Get('stream')
  async streamAll(@Res() res: Response) {
    // Configurar headers de SSE
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Enviar comentario inicial
    res.write(': conectado a todos los viewers en tiempo real\n\n');

    let updateCount = 0;

    const sendUpdate = async () => {
      try {
        const snapshot = await this.viewersCacheService.readSnapshot();

        const message = {
          type: 'all_viewers_update',
          data: snapshot,
          updateNumber: ++updateCount,
          timestamp: new Date(),
        };

        res.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch (error) {
        const errorMessage = {
          type: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date(),
        };
        res.write(`data: ${JSON.stringify(errorMessage)}\n\n`);
      }
    };

    // Enviar primera actualización inmediatamente
    await sendUpdate();

    // Enviar actualización cada 5 segundos
    const interval = setInterval(async () => {
      await sendUpdate();
    }, 5000);

    // Limpiar cuando se cierre la conexión
    res.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  }

  /**
   * Server-Sent Events: Streaming de viewers de TikTok
   * GET /api/v1/viewers-cache/tiktok/stream
   */
  @Get('tiktok/stream')
  async streamTikTok(@Res() res: Response) {
    // Configurar headers de SSE
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Enviar comentario inicial
    res.write(': conectado a viewers de TikTok en tiempo real\n\n');

    let updateCount = 0;

    const sendUpdate = async () => {
      try {
        const tiktokData = await this.viewersCacheService.readTikTokSnapshot();

        const message = {
          type: 'tiktok_viewers_update',
          data: tiktokData,
          updateNumber: ++updateCount,
          timestamp: new Date(),
        };

        res.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch (error) {
        const errorMessage = {
          type: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date(),
        };
        res.write(`data: ${JSON.stringify(errorMessage)}\n\n`);
      }
    };

    // Enviar primera actualización inmediatamente
    await sendUpdate();

    // Enviar actualización cada 5 segundos
    const interval = setInterval(async () => {
      await sendUpdate();
    }, 5000);

    // Limpiar cuando se cierre la conexión
    res.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  }

  /**
   * Server-Sent Events: Streaming de viewers de YouTube
   * GET /api/v1/viewers-cache/youtube/stream
   */
  @Get('youtube/stream')
  async streamYoutube(@Res() res: Response) {
    // Configurar headers de SSE
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Enviar comentario inicial
    res.write(': conectado a viewers de YouTube en tiempo real\n\n');

    let updateCount = 0;

    const sendUpdate = async () => {
      try {
        const youtubeData =
          await this.viewersCacheService.readYoutubeSnapshot();

        const message = {
          type: 'youtube_viewers_update',
          data: youtubeData,
          updateNumber: ++updateCount,
          timestamp: new Date(),
        };

        res.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch (error) {
        const errorMessage = {
          type: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date(),
        };
        res.write(`data: ${JSON.stringify(errorMessage)}\n\n`);
      }
    };

    // Enviar primera actualización inmediatamente
    await sendUpdate();

    // Enviar actualización cada 5 segundos
    const interval = setInterval(async () => {
      await sendUpdate();
    }, 5000);

    // Limpiar cuando se cierre la conexión
    res.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  }

  /**
   * Server-Sent Events: Streaming de viewers de Facebook
   * GET /api/v1/viewers-cache/facebook/stream
   */
  @Get('facebook/stream')
  async streamFacebook(@Res() res: Response) {
    // Configurar headers de SSE
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Enviar comentario inicial
    res.write(': conectado a viewers de Facebook en tiempo real\n\n');

    let updateCount = 0;

    const sendUpdate = async () => {
      try {
        const facebookData = await this.viewersCacheService.readFacebookSnapshot();

        const message = {
          type: 'facebook_viewers_update',
          data: facebookData,
          updateNumber: ++updateCount,
          timestamp: new Date(),
        };

        res.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch (error) {
        const errorMessage = {
          type: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date(),
        };
        res.write(`data: ${JSON.stringify(errorMessage)}\n\n`);
      }
    };

    // Enviar primera actualización inmediatamente
    await sendUpdate();

    // Enviar actualización cada 5 segundos
    const interval = setInterval(async () => {
      await sendUpdate();
    }, 5000);

    // Limpiar cuando se cierre la conexión
    res.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  }
}
