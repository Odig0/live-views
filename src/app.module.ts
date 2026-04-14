import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TikTokLiveModule } from './tiktok-live/tiktok-live.module';
import { ViewersCacheModule } from './viewers-cache/viewers-cache.module';
import { YoutubeLiveModule } from './youtube-live/youtube-live.module';

@Module({
  imports: [ViewersCacheModule, TikTokLiveModule, YoutubeLiveModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
