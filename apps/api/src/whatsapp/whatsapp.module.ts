import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { MetaSignatureGuard } from './meta-signature.guard';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappSender } from './whatsapp.sender';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [ChatModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappSender, MetaSignatureGuard],
})
export class WhatsappModule {}
