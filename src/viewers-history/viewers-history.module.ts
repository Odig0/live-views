import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/postgres.module';
import { TikTokLiveModule } from '../tiktok-live/tiktok-live.module';
import { ViewersCacheModule } from '../viewers-cache/viewers-cache.module';
import { YoutubeLiveModule } from '../youtube-live/youtube-live.module';
import { LiveCountJsonHistoryService } from './live-count-json-history.service';
import { ViewersHistoryController } from './viewers-history.controller';
import { ViewersHistoryService } from './viewers-history.service';

@Global()
@Module({
  controllers: [ViewersHistoryController],
  imports: [
    DatabaseModule,
    TikTokLiveModule,
    ViewersCacheModule,
    YoutubeLiveModule,
  ],
  providers: [ViewersHistoryService, LiveCountJsonHistoryService],
  exports: [ViewersHistoryService],
})
export class ViewersHistoryModule {}