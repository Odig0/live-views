import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { YoutubeLiveService } from './youtube-live.service';
import { YoutubeLiveError } from './youtube-live.types';
import { YoutubeWebsocketManagerService } from './youtube-websocket-manager.service';
import { ViewersCacheService } from '../viewers-cache/viewers-cache.service';
import { ViewersHistoryService } from '../viewers-history/viewers-history.service';

@Controller('api/v1/youtube')
export class YoutubeLiveController {
  constructor(
    private readonly youtubeLiveService: YoutubeLiveService,
    private readonly youtubeWsManager: YoutubeWebsocketManagerService,
    private readonly viewersCacheService: ViewersCacheService,
    private readonly viewersHistoryService: ViewersHistoryService,
  ) {}

  @Get('live-viewers')
  async getLiveViewers(@Query('url') url: string) {
    if (!url || url.trim() === '') {
      throw new HttpException(
        {
          message: 'Query parameter url is required',
          code: 'INVALID_URL',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const data = await this.youtubeLiveService.getLiveViewersByUrl(url);

      await this.viewersCacheService.upsertYoutube({
        videoId: data.videoId,
        concurrentViewers: data.concurrentViewers,
        title: data.title,
        channelTitle: data.channelTitle,
        isLive: data.isLive,
      });

      await this.viewersHistoryService.recordYoutubeSnapshot({
        videoId: data.videoId,
        concurrentViewers: data.concurrentViewers,
        title: data.title,
        channelTitle: data.channelTitle,
        isLive: data.isLive,
        sourceUrl: url,
        capturedAt: data.fetchedAt,
        metadata: {
          route: '/api/v1/youtube/live-viewers',
        },
      });

      this.viewersHistoryService.ensureYoutubeTracking(data.videoId);

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (error instanceof YoutubeLiveError) {
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
  async streamLiveViewers(@Query('url') url: string, @Res() res: Response) {
    if (!url || url.trim() === '') {
      throw new HttpException(
        {
          message: 'Query parameter url is required',
          code: 'INVALID_URL',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const clientId = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    res.write(': connected to youtube live viewers SSE\n\n');

    try {
      const requestedVideoId = this.youtubeLiveService.extractVideoId(url);
      this.viewersHistoryService.ensureYoutubeTracking(requestedVideoId);

      const subscription = await this.youtubeWsManager.subscribe(
        clientId,
        url,
        (message) => {
          res.write(`data: ${JSON.stringify(message)}\n\n`);
        },
      );

      res.write(
        `data: ${JSON.stringify({
          type: 'subscribed',
          videoId: subscription.videoId,
          pollIntervalSeconds: subscription.pollIntervalSeconds,
          sentAt: new Date(),
        })}\n\n`,
      );
    } catch (error) {
      this.youtubeWsManager.unsubscribe(clientId);

      if (error instanceof YoutubeLiveError) {
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

    res.on('close', () => {
      this.youtubeWsManager.unsubscribe(clientId);
      res.end();
    });

    res.on('error', () => {
      this.youtubeWsManager.unsubscribe(clientId);
      res.end();
    });
  }
}
