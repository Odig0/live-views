import { Module, OnModuleDestroy } from '@nestjs/common';
import { TikTokLiveService } from './tiktok-live.service';
import { TikTokLiveController } from './tiktok-live.controller';
import { TikTokRealtimeService } from './tiktok-realtime.service';
import { TikTokCacheService } from './tiktok-cache.service';

@Module({
  controllers: [TikTokLiveController],
  providers: [TikTokLiveService, TikTokRealtimeService, TikTokCacheService],
  exports: [TikTokLiveService, TikTokRealtimeService, TikTokCacheService],
})
export class TikTokLiveModule implements OnModuleDestroy {
  constructor(private cacheService: TikTokCacheService) {}

  onModuleDestroy() {
    this.cacheService.onModuleDestroy();
  }
}
