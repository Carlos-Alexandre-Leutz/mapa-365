import { Injectable, Logger } from '@nestjs/common';

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

const MAX_ATTEMPTS = 3;

@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);

  async generate(systemPrompt: string, history: ChatTurn[]): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: history.map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    });

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body,
        signal: AbortSignal.timeout(20_000),
      });

      if (response.ok) {
        return this.extractText(await response.json());
      }

      const retryable = response.status === 429 || response.status >= 500;
      this.logger.warn(
        `Gemini respondeu ${response.status} (tentativa ${attempt}/${MAX_ATTEMPTS})`,
      );
      if (!retryable || attempt === MAX_ATTEMPTS) {
        throw new Error(`Gemini falhou com status ${response.status}`);
      }
      await this.sleep(500 * attempt);
    }
    throw new Error('Gemini falhou');
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractText(data: any): string {
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((part: { text?: string }) => part.text ?? '')
      .join('')
      .trim();
    if (!text) {
      throw new Error('Gemini devolveu uma resposta vazia');
    }
    return text;
  }
}
