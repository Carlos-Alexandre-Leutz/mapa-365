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
    if (result.handoff) {
      await this.notifyOwner(message);
    }
  }

  private async notifyOwner(message: TextMessage): Promise<void> {
    const owner = process.env.HANDOFF_NOTIFY_NUMBER;
    if (!owner) {
      this.logger.warn('HANDOFF_NOTIFY_NUMBER não configurado; handoff sem aviso');
      return;
    }
    const who = message.name ? `${message.name} (${message.from})` : message.from;
    const snippet = message.text.length > 200 ? `${message.text.slice(0, 200)}...` : message.text;
    try {
      await this.sender.sendText(
        owner,
        `Pediram atendimento humano: ${who}\n\nÚltima mensagem: "${snippet}"\n\nA IA parou de responder nessa conversa.`,
      );
    } catch (error) {
      // A Meta só aceita texto livre até 24h depois da última mensagem do destinatário.
      this.logger.error(`Não consegui avisar o responsável: ${(error as Error).message}`);
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
