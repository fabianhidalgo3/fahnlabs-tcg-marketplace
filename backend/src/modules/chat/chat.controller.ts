import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ChatService, ChatTurn } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/current-user.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** Chat IA: busca cartas (base + web), importa y agrega a la colección. */
  @Post()
  send(
    @CurrentUser() user: AuthUser,
    @Body() body: { messages: ChatTurn[] },
  ) {
    return this.chat.chat(user.id, (body.messages ?? []).slice(-20));
  }
}
