import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FacebookLiveModule } from './facebook-live/facebook-live.module';
import { TikTokLiveModule } from './tiktok-live/tiktok-live.module';
import { ViewersCacheModule } from './viewers-cache/viewers-cache.module';
import { ViewersHistoryModule } from './viewers-history/viewers-history.module';
import { YoutubeLiveModule } from './youtube-live/youtube-live.module';

@Module({
  imports: [
    ViewersCacheModule,
    ViewersHistoryModule,
    TikTokLiveModule,
    YoutubeLiveModule,
    FacebookLiveModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
