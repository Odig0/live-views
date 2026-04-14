import { Global, Module } from '@nestjs/common';
import { ViewersCacheController } from './viewers-cache.controller';
import { ViewersCacheService } from './viewers-cache.service';

@Global()
@Module({
  controllers: [ViewersCacheController],
  providers: [ViewersCacheService],
  exports: [ViewersCacheService],
})
export class ViewersCacheModule {}
