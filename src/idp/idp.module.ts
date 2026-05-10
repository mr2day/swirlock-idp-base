import { Module } from '@nestjs/common';
import { InteractionsController } from './interactions/interactions.controller';

@Module({
  controllers: [InteractionsController],
})
export class IdpModule {}
