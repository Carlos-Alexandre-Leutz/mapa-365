import { Injectable, Logger } from '@nestjs/common';

const MAX_TEXT_LENGTH = 4000;

@Injectable()
export class WhatsappSender {
  private readonly logger = new Logger(WhatsappSender.name);

  async sendText(to: string, body: string): Promise<void> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
      throw new Error('WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados');
    }
    const version = process.env.WHATSAPP_API_VERSION ?? 'v23.0';

    const graphUrl = process.env.WHATSAPP_GRAPH_URL ?? 'https://graph.facebook.com';
    const response = await fetch(
      `${graphUrl}/${version}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: body.slice(0, MAX_TEXT_LENGTH) },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(`Meta recusou o envio (${response.status}): ${detail}`);
      throw new Error(`Envio ao WhatsApp falhou com status ${response.status}`);
    }
  }
}
