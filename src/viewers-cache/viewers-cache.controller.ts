import { Controller, Get } from '@nestjs/common';
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

  @Get('youtube')
  async getYoutube(): Promise<{ success: boolean; data: unknown }> {
    return {
      success: true,
      data: await this.viewersCacheService.readYoutubeSnapshot(),
    };
  }
}
