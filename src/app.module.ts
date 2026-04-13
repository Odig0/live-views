import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TikTokLiveModule } from './tiktok-live/tiktok-live.module';

@Module({
  imports: [TikTokLiveModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
