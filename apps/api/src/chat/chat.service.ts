import { Injectable, Logger } from '@nestjs/common';
import { Channel, MessageRole, Prisma } from '@prisma/client';
import { ChatTurn, GeminiClient } from '../ai/gemini.client';
import { KnowledgeService } from '../ai/knowledge.service';
import { PrismaService } from '../prisma/prisma.service';

export interface IncomingMessage {
  channel: Channel;
  externalId: string;
  name?: string;
  text: string;
  messageId?: string;
}

export type ChatStatus = 'replied' | 'duplicate' | 'error';

export interface ChatResult {
  status: ChatStatus;
  reply: string | null;
  conversationId?: string;
}

const HISTORY_LIMIT = 20;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiClient,
    private readonly knowledge: KnowledgeService,
  ) {}

  async handleIncoming(incoming: IncomingMessage): Promise<ChatResult> {
    if (incoming.messageId && (await this.alreadyProcessed(incoming.messageId))) {
      return { status: 'duplicate', reply: null };
    }

    const conversation = await this.findOrCreateConversation(incoming);

    try {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: MessageRole.USER,
          content: incoming.text,
          externalId: incoming.messageId,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return { status: 'duplicate', reply: null };
      }
      throw error;
    }

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastUserMessageAt: new Date() },
    });

    try {
      const history = await this.loadHistory(conversation.id);
      const reply = await this.gemini.generate(
        this.knowledge.getSystemPrompt(),
        history,
      );
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: MessageRole.ASSISTANT,
          content: reply,
        },
      });
      return { status: 'replied', reply, conversationId: conversation.id };
    } catch (error) {
      this.logger.error(
        `Falha ao responder a conversa ${conversation.id}: ${(error as Error).message}`,
      );
      return { status: 'error', reply: null, conversationId: conversation.id };
    }
  }

  private async alreadyProcessed(messageId: string): Promise<boolean> {
    const existing = await this.prisma.message.findUnique({
      where: { externalId: messageId },
      select: { id: true },
    });
    return existing !== null;
  }

  private async findOrCreateConversation(incoming: IncomingMessage) {
    const contact = await this.prisma.contact.upsert({
      where: {
        channel_externalId: {
          channel: incoming.channel,
          externalId: incoming.externalId,
        },
      },
      update: incoming.name ? { name: incoming.name } : {},
      create: {
        channel: incoming.channel,
        externalId: incoming.externalId,
        name: incoming.name,
      },
    });

    const existing = await this.prisma.conversation.findFirst({
      where: { contactId: contact.id },
      orderBy: { createdAt: 'desc' },
    });
    return (
      existing ??
      (await this.prisma.conversation.create({
        data: { contactId: contact.id },
      }))
    );
  }

  private async loadHistory(conversationId: string): Promise<ChatTurn[]> {
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });

    const turns: ChatTurn[] = [];
    for (const row of rows.reverse()) {
      const role = row.role === MessageRole.USER ? 'user' : 'model';
      const last = turns[turns.length - 1];
      if (last && last.role === role) {
        last.text += `\n${row.content}`;
      } else {
        turns.push({ role, text: row.content });
      }
    }
    while (turns.length > 0 && turns[0].role !== 'user') {
      turns.shift();
    }
    return turns;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
