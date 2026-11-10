import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ChatService } from './chat.service';

@Module({
  imports: [AiModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
