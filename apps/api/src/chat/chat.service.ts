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

export type ChatStatus = 'replied' | 'duplicate' | 'human' | 'quota' | 'error';

export interface ChatResult {
  status: ChatStatus;
  reply: string | null;
  conversationId?: string;
  handoff?: boolean;
}

const HISTORY_LIMIT = 20;
const DEFAULT_DAILY_LIMIT = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const HANDOFF_MARKER = '[[HUMANO]]';
const HANDOFF_REQUEST = /\b(falar com|conversar com|chamar|passa(?:r)? (?:para|pra)) (?:(?:o|a|um|uma) )?(?:alexandre|atendente|humano|pessoa)\b/i;
const DEFAULT_HANDOFF_MESSAGE =
  'Claro! Vou avisar o Alexandre e ele continua essa conversa com você por aqui.';
const DEFAULT_QUOTA_MESSAGE =
  'Por hoje atingimos o limite de mensagens por aqui. Amanhã eu volto a te responder. 🙂';

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

    if (conversation.humanTakeover) {
      return { status: 'human', reply: null, conversationId: conversation.id };
    }

    const quota = await this.checkQuota(conversation);
    if (quota.exceeded) {
      return {
        status: 'quota',
        reply: quota.firstExcess ? this.quotaMessage() : null,
        conversationId: conversation.id,
      };
    }

    if (HANDOFF_REQUEST.test(incoming.text)) {
      return this.handOff(conversation.id, this.handoffMessage());
    }

    try {
      const history = await this.loadHistory(conversation.id);
      const reply = await this.gemini.generate(
        this.knowledge.getSystemPrompt(),
        history,
      );
      if (reply.includes(HANDOFF_MARKER)) {
        const clean = reply.replaceAll(HANDOFF_MARKER, '').trim();
        return this.handOff(conversation.id, clean || this.handoffMessage());
      }
      await this.saveAssistantMessage(conversation.id, reply);
      return { status: 'replied', reply, conversationId: conversation.id };
    } catch (error) {
      this.logger.error(
        `Falha ao responder a conversa ${conversation.id}: ${(error as Error).message}`,
      );
      return { status: 'error', reply: null, conversationId: conversation.id };
    }
  }

  async setHumanTakeover(conversationId: string, active: boolean) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { humanTakeover: active, handoffAt: active ? new Date() : null },
    });
  }

  private async handOff(conversationId: string, reply: string): Promise<ChatResult> {
    await this.saveAssistantMessage(conversationId, reply);
    await this.setHumanTakeover(conversationId, true);
    return { status: 'replied', reply, conversationId, handoff: true };
  }

  private saveAssistantMessage(conversationId: string, content: string) {
    return this.prisma.message.create({
      data: { conversationId, role: MessageRole.ASSISTANT, content },
    });
  }

  private handoffMessage(): string {
    return process.env.HANDOFF_MESSAGE || DEFAULT_HANDOFF_MESSAGE;
  }

  private async checkQuota(conversation: { contactId: string }) {
    const limit = this.dailyLimit();
    const used = await this.prisma.message.count({
      where: {
        role: MessageRole.USER,
        createdAt: { gte: new Date(Date.now() - DAY_MS) },
        conversation: { contactId: conversation.contactId },
      },
    });
    return { exceeded: used > limit, firstExcess: used === limit + 1 };
  }

  private dailyLimit(): number {
    const configured = Number(process.env.DAILY_MESSAGE_LIMIT);
    return Number.isInteger(configured) && configured > 0
      ? configured
      : DEFAULT_DAILY_LIMIT;
  }

  private quotaMessage(): string {
    return process.env.QUOTA_MESSAGE || DEFAULT_QUOTA_MESSAGE;
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
