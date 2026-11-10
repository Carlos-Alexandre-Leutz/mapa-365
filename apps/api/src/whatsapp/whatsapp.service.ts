import { Injectable, Logger } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import { WhatsappSender } from './whatsapp.sender';

interface TextMessage {
  from: string;
  id: string;
  text: string;
  name?: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly chat: ChatService,
    private readonly sender: WhatsappSender,
  ) {}

  async process(payload: any): Promise<void> {
    for (const message of this.extractTextMessages(payload)) {
      try {
        await this.handle(message);
      } catch (error) {
        this.logger.error(
          `Falha ao tratar a mensagem ${message.id}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async handle(message: TextMessage): Promise<void> {
    const result = await this.chat.handleIncoming({
      channel: 'WHATSAPP',
      externalId: message.from,
      name: message.name,
      text: message.text,
      messageId: message.id,
    });

    if (result.reply) {
      await this.sender.sendText(message.from, result.reply);
    }
  }

  private extractTextMessages(payload: any): TextMessage[] {
    const found: TextMessage[] = [];
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        for (const message of value?.messages ?? []) {
          if (message?.type !== 'text' || !message.text?.body) {
            this.logger.log(`Ignorando mensagem ${message?.id} do tipo ${message?.type}`);
            continue;
          }
          const contact = (value.contacts ?? []).find(
            (c: any) => c?.wa_id === message.from,
          );
          found.push({
            from: message.from,
            id: message.id,
            text: message.text.body,
            name: contact?.profile?.name,
          });
        }
      }
    }
    return found;
  }
}
