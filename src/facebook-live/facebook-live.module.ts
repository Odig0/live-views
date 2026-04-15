import { Module } from '@nestjs/common';
import { FacebookLiveController } from './facebook-live.controller';
import { FacebookLiveService } from './facebook-live.service';

@Module({
  controllers: [FacebookLiveController],
  providers: [FacebookLiveService],
  exports: [FacebookLiveService],
})
export class FacebookLiveModule {}
