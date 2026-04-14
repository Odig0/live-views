import { Module } from '@nestjs/common';
import { YoutubeLiveController } from './youtube-live.controller';
import { YoutubeLiveGateway } from './youtube-live.gateway';
import { YoutubeLiveService } from './youtube-live.service';
import { YoutubeWebsocketManagerService } from './youtube-websocket-manager.service';

@Module({
  controllers: [YoutubeLiveController],
  providers: [YoutubeLiveService, YoutubeWebsocketManagerService, YoutubeLiveGateway],
  exports: [YoutubeLiveService, YoutubeWebsocketManagerService],
})
export class YoutubeLiveModule {}
