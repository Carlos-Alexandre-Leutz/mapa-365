import { MessageRole, Prisma } from '@prisma/client';
import { ChatService } from './chat.service';

const conversation = { id: 'conv-1', contactId: 'contact-1', humanTakeover: false };

function buildPrisma() {
  return {
    message: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(1),
    },
    contact: { upsert: jest.fn().mockResolvedValue({ id: 'contact-1' }) },
    conversation: {
      findFirst: jest.fn().mockResolvedValue(conversation),
      create: jest.fn().mockResolvedValue(conversation),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('ChatService', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let gemini: { generate: jest.Mock };
  let knowledge: { getSystemPrompt: jest.Mock };
  let service: ChatService;

  const incoming = {
    channel: 'WHATSAPP' as const,
    externalId: '5547999990000',
    name: 'Maria',
    text: 'Oi, quero saber do curso',
    messageId: 'wamid.1',
  };

  beforeEach(() => {
    prisma = buildPrisma();
    gemini = { generate: jest.fn().mockResolvedValue('Oi, Maria! Qual sua maior dificuldade?') };
    knowledge = { getSystemPrompt: jest.fn().mockReturnValue('prompt do sistema') };
    service = new ChatService(prisma as any, gemini as any, knowledge as any);
    prisma.message.findMany.mockResolvedValue([
      { role: MessageRole.USER, content: incoming.text },
    ]);
  });

  it('guarda a pergunta, chama a IA e guarda a resposta', async () => {
    const result = await service.handleIncoming(incoming);

    expect(result).toEqual({
      status: 'replied',
      reply: 'Oi, Maria! Qual sua maior dificuldade?',
      conversationId: 'conv-1',
    });
    expect(gemini.generate).toHaveBeenCalledWith('prompt do sistema', [
      { role: 'user', text: incoming.text },
    ]);
    const roles = prisma.message.create.mock.calls.map((c) => c[0].data.role);
    expect(roles).toEqual([MessageRole.USER, MessageRole.ASSISTANT]);
    expect(prisma.message.create.mock.calls[0][0].data.externalId).toBe('wamid.1');
  });

  it('cria o contato por canal e id externo', async () => {
    await service.handleIncoming(incoming);
    expect(prisma.contact.upsert.mock.calls[0][0].where).toEqual({
      channel_externalId: { channel: 'WHATSAPP', externalId: '5547999990000' },
    });
  });

  it('cria a conversa quando o contato ainda não tem uma', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);
    await service.handleIncoming(incoming);
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: { contactId: 'contact-1' },
    });
  });

  describe('cota diária', () => {
    afterEach(() => {
      delete process.env.DAILY_MESSAGE_LIMIT;
      delete process.env.QUOTA_MESSAGE;
    });

    it('conta só as mensagens do contato nas últimas 24 horas', async () => {
      await service.handleIncoming(incoming);
      const where = prisma.message.count.mock.calls[0][0].where;
      expect(where.role).toBe(MessageRole.USER);
      expect(where.conversation).toEqual({ contactId: 'contact-1' });
      expect(Date.now() - where.createdAt.gte.getTime()).toBeGreaterThan(23 * 3600_000);
    });

    it('responde normalmente até o limite', async () => {
      process.env.DAILY_MESSAGE_LIMIT = '5';
      prisma.message.count.mockResolvedValue(5);
      const result = await service.handleIncoming(incoming);
      expect(result.status).toBe('replied');
    });

    it('avisa uma vez ao passar do limite e não chama a IA', async () => {
      process.env.DAILY_MESSAGE_LIMIT = '5';
      prisma.message.count.mockResolvedValue(6);
      const result = await service.handleIncoming(incoming);
      expect(result.status).toBe('quota');
      expect(result.reply).toContain('limite');
      expect(gemini.generate).not.toHaveBeenCalled();
    });

    it('depois do aviso, fica em silêncio sem gastar IA', async () => {
      process.env.DAILY_MESSAGE_LIMIT = '5';
      prisma.message.count.mockResolvedValue(7);
      const result = await service.handleIncoming(incoming);
      expect(result).toMatchObject({ status: 'quota', reply: null });
      expect(gemini.generate).not.toHaveBeenCalled();
    });

    it('usa a mensagem configurada e ignora limite inválido', async () => {
      process.env.DAILY_MESSAGE_LIMIT = 'abc';
      process.env.QUOTA_MESSAGE = 'Volte amanhã!';
      prisma.message.count.mockResolvedValue(31);
      const result = await service.handleIncoming(incoming);
      expect(result.reply).toBe('Volte amanhã!');
    });
  });

  describe('handoff para humano', () => {
    afterEach(() => {
      delete process.env.HANDOFF_MESSAGE;
    });

    it('não responde quando o humano já assumiu, mas guarda a mensagem', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ ...conversation, humanTakeover: true });
      const result = await service.handleIncoming(incoming);
      expect(result).toMatchObject({ status: 'human', reply: null });
      expect(gemini.generate).not.toHaveBeenCalled();
      expect(prisma.message.create).toHaveBeenCalledTimes(1);
    });

    it('a IA pede handoff com o marcador, que é removido da resposta', async () => {
      gemini.generate.mockResolvedValue('Vou chamar o Alexandre. [[HUMANO]]');
      const result = await service.handleIncoming(incoming);
      expect(result).toMatchObject({ status: 'replied', reply: 'Vou chamar o Alexandre.', handoff: true });
      expect(prisma.conversation.update).toHaveBeenLastCalledWith({
        where: { id: 'conv-1' },
        data: { humanTakeover: true, handoffAt: expect.any(Date) },
      });
      const saved = prisma.message.create.mock.calls.at(-1)![0].data;
      expect(saved.content).toBe('Vou chamar o Alexandre.');
    });

    it('pedido explícito do contato dispara handoff sem chamar a IA', async () => {
      const result = await service.handleIncoming({ ...incoming, text: 'quero falar com o Alexandre' });
      expect(result).toMatchObject({ status: 'replied', handoff: true });
      expect(result.reply).toContain('Alexandre');
      expect(gemini.generate).not.toHaveBeenCalled();
    });

    it.each([
      'quero falar com uma pessoa',
      'pode chamar o atendente?',
      'me passa pra um humano',
      'preciso conversar com o Alexandre',
    ])('reconhece o pedido: %s', async (text) => {
      const result = await service.handleIncoming({ ...incoming, text });
      expect(result.handoff).toBe(true);
    });

    it('não confunde conversa normal com pedido de humano', async () => {
      const result = await service.handleIncoming({ ...incoming, text: 'falar com calma sobre o curso' });
      expect(result.handoff).toBeUndefined();
      expect(gemini.generate).toHaveBeenCalled();
    });

    it('usa a mensagem de handoff configurada', async () => {
      process.env.HANDOFF_MESSAGE = 'Já te chamo!';
      const result = await service.handleIncoming({ ...incoming, text: 'quero falar com um atendente' });
      expect(result.reply).toBe('Já te chamo!');
    });

    it('setHumanTakeover(false) devolve a conversa para a IA', async () => {
      await service.setHumanTakeover('conv-1', false);
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { humanTakeover: false, handoffAt: null },
      });
    });
  });

  it('ignora a mensagem repetida sem chamar a IA', async () => {
    prisma.message.findUnique.mockResolvedValue({ id: 'ja-existe' });

    const result = await service.handleIncoming(incoming);

    expect(result.status).toBe('duplicate');
    expect(gemini.generate).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('trata corrida de entrega dupla pelo índice único', async () => {
    prisma.message.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicada', {
        code: 'P2002',
        clientVersion: 'teste',
      }),
    );

    const result = await service.handleIncoming(incoming);

    expect(result.status).toBe('duplicate');
    expect(gemini.generate).not.toHaveBeenCalled();
  });

  it('devolve erro sem guardar resposta quando a IA falha', async () => {
    gemini.generate.mockRejectedValue(new Error('Gemini caiu'));

    const result = await service.handleIncoming(incoming);

    expect(result).toEqual({ status: 'error', reply: null, conversationId: 'conv-1' });
    expect(prisma.message.create).toHaveBeenCalledTimes(1);
  });

  it('monta o histórico na ordem, junta turnos seguidos e começa pelo usuário', async () => {
    prisma.message.findMany.mockResolvedValue([
      { role: MessageRole.USER, content: 'c' },
      { role: MessageRole.ASSISTANT, content: 'b' },
      { role: MessageRole.HUMAN, content: 'b2' },
      { role: MessageRole.USER, content: 'a2' },
      { role: MessageRole.USER, content: 'a' },
    ]);

    await service.handleIncoming(incoming);

    expect(gemini.generate.mock.calls[0][1]).toEqual([
      { role: 'user', text: 'a\na2' },
      { role: 'model', text: 'b2\nb' },
      { role: 'user', text: 'c' },
    ]);
  });
});
