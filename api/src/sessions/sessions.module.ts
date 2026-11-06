import { Module } from '@nestjs/common';
import { Clock } from './clock';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, Clock],
})
export class SessionsModule {}
