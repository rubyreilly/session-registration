import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { CreateSessionDto, RegisterDto } from './sessions.dto';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list() {
    return this.sessions.listUpcoming();
  }

  @Post()
  create(@Body() dto: CreateSessionDto) {
    return this.sessions.create(dto);
  }

  @Post(':id/registrations')
  register(@Param('id') id: string, @Body() dto: RegisterDto) {
    return this.sessions.register(id, dto.email);
  }

  @Delete(':id/registrations/:email')
  @HttpCode(204)
  unregister(@Param('id') id: string, @Param('email') email: string) {
    this.sessions.unregister(id, email);
  }
}
