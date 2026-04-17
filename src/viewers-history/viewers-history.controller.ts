import { Controller, Get, Query } from '@nestjs/common';
import { LiveCountJsonHistoryService } from './live-count-json-history.service';

@Controller('api/v1/viewers-history')
export class ViewersHistoryController {
  constructor(private readonly liveCountJsonHistoryService: LiveCountJsonHistoryService) {}

  @Get('averages')
  async getMinuteAverages(
    @Query('windowMinutes') windowMinutes?: string,
    @Query('platform') platform?: 'tiktok' | 'youtube',
    @Query('channelName') channelName?: string,
  ) {
    const parsedWindowMinutes = Number.parseInt(windowMinutes ?? '60', 10);

    return {
      success: true,
      data: await this.liveCountJsonHistoryService.readMinuteAverages({
        windowMinutes: Number.isNaN(parsedWindowMinutes) ? 60 : parsedWindowMinutes,
        platform,
        channelName,
      }),
    };
  }
}