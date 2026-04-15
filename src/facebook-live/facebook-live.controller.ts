import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ViewersCacheService } from '../viewers-cache/viewers-cache.service';
import { FacebookLiveError } from './facebook-live.types';
import { FacebookLiveService } from './facebook-live.service';

@Controller('api/v1/facebook')
export class FacebookLiveController {
  constructor(
    private readonly facebookLiveService: FacebookLiveService,
    private readonly viewersCacheService: ViewersCacheService,
  ) {}

  @Get('live-viewers')
  async getLiveViewers(@Query('videoId') videoId?: string) {
    try {
      const data = await this.facebookLiveService.getLiveViewers(videoId);

      await this.viewersCacheService.upsertFacebook({
        pageId: data.pageId,
        videoId: data.videoId,
        concurrentViewers: data.concurrentViewers,
        title: data.title,
        status: data.status,
        permalinkUrl: data.permalinkUrl,
        isLive: data.isLive,
      });

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (error instanceof FacebookLiveError) {
        throw new HttpException(
          {
            message: error.message,
            code: error.code,
          },
          error.statusCode,
        );
      }

      throw new HttpException(
        {
          message:
            error instanceof Error
              ? error.message
              : 'Unexpected server error',
          code: 'UNKNOWN_ERROR',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('live')
  async streamLiveViewers(
    @Query('videoId') videoId: string | undefined,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.write(': connected to facebook live viewers SSE\n\n');

    let updateCount = 0;

    const sendUpdate = async () => {
      try {
        const data = await this.facebookLiveService.getLiveViewers(videoId);

        await this.viewersCacheService.upsertFacebook({
          pageId: data.pageId,
          videoId: data.videoId,
          concurrentViewers: data.concurrentViewers,
          title: data.title,
          status: data.status,
          permalinkUrl: data.permalinkUrl,
          isLive: data.isLive,
        });

        const message = {
          type: 'facebook_live_viewers_update',
          data,
          updateNumber: ++updateCount,
          timestamp: new Date(),
        };

        res.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch (error) {
        const payload =
          error instanceof FacebookLiveError
            ? {
                type: 'error',
                code: error.code,
                message: error.message,
                timestamp: new Date(),
              }
            : {
                type: 'error',
                code: 'UNKNOWN_ERROR',
                message: error instanceof Error ? error.message : 'Unexpected server error',
                timestamp: new Date(),
              };

        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    await sendUpdate();

    const interval = setInterval(async () => {
      await sendUpdate();
    }, 10000);

    res.on('close', () => {
      clearInterval(interval);
      res.end();
    });

    res.on('error', () => {
      clearInterval(interval);
      res.end();
    });
  }
}
