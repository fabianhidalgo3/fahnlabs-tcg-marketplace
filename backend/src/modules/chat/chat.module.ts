import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { CollectionModule } from '../collection/collection.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';

@Module({
  imports: [CardsModule, CollectionModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
