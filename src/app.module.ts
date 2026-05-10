import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { IdpModule } from './idp/idp.module';

@Module({
  imports: [IdpModule],
  controllers: [HealthController],
})
export class AppModule {}
