import { WhatsappService } from './whatsapp.service';

const payload = (messages: unknown[], contacts: unknown[] = []) => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: { messages, contacts } }] }],
});

const text = (id: string, body = 'oi', from = '5547999990000') => ({
  from,
  id,
  type: 'text',
  text: { body },
});

describe('WhatsappService', () => {
  let chat: { handleIncoming: jest.Mock };
  let sender: { sendText: jest.Mock };
  let service: WhatsappService;

  beforeEach(() => {
    chat = { handleIncoming: jest.fn().mockResolvedValue({ status: 'replied', reply: 'Olá!' }) };
    sender = { sendText: jest.fn().mockResolvedValue(undefined) };
    service = new WhatsappService(chat as any, sender as any);
  });

  it('passa a mensagem para a IA e envia a resposta', async () => {
    await service.process(
      payload([text('wamid.1', 'quero saber do curso')], [
        { wa_id: '5547999990000', profile: { name: 'Maria' } },
      ]),
    );

    expect(chat.handleIncoming).toHaveBeenCalledWith({
      channel: 'WHATSAPP',
      externalId: '5547999990000',
      name: 'Maria',
      text: 'quero saber do curso',
      messageId: 'wamid.1',
    });
    expect(sender.sendText).toHaveBeenCalledWith('5547999990000', 'Olá!');
  });

  it.each(['duplicate', 'human', 'quota', 'error'])(
    'não envia nada quando o status é %s e não há resposta',
    async (status) => {
      chat.handleIncoming.mockResolvedValue({ status, reply: null });
      await service.process(payload([text('wamid.1')]));
      expect(sender.sendText).not.toHaveBeenCalled();
    },
  );

  it('ignora mensagens que não são texto', async () => {
    await service.process(payload([{ from: '1', id: 'x', type: 'image' }]));
    expect(chat.handleIncoming).not.toHaveBeenCalled();
  });

  it('ignora notificações de status, sem mensagens', async () => {
    await service.process({ entry: [{ changes: [{ value: { statuses: [{ id: 's' }] } }] }] });
    expect(chat.handleIncoming).not.toHaveBeenCalled();
  });

  it('aguenta payload vazio ou malformado', async () => {
    await expect(service.process(undefined)).resolves.toBeUndefined();
    await expect(service.process({ entry: 'x' })).resolves.toBeUndefined();
    expect(chat.handleIncoming).not.toHaveBeenCalled();
  });

  describe('aviso de handoff ao responsável', () => {
    afterEach(() => {
      delete process.env.HANDOFF_NOTIFY_NUMBER;
    });

    const handoff = () =>
      chat.handleIncoming.mockResolvedValue({ status: 'replied', reply: 'Já chamo o Alexandre', handoff: true });

    it('avisa o número do responsável com quem pediu e o que disse', async () => {
      process.env.HANDOFF_NOTIFY_NUMBER = '5547988887777';
      handoff();
      await service.process(
        payload([text('wamid.1', 'quero falar com o Alexandre')], [
          { wa_id: '5547999990000', profile: { name: 'Maria' } },
        ]),
      );

      expect(sender.sendText).toHaveBeenNthCalledWith(1, '5547999990000', 'Já chamo o Alexandre');
      const [to, body] = sender.sendText.mock.calls[1];
      expect(to).toBe('5547988887777');
      expect(body).toContain('Maria (5547999990000)');
      expect(body).toContain('quero falar com o Alexandre');
    });

    it('resume mensagens muito longas no aviso', async () => {
      process.env.HANDOFF_NOTIFY_NUMBER = '5547988887777';
      handoff();
      await service.process(payload([text('wamid.1', 'x'.repeat(500))]));
      expect(sender.sendText.mock.calls[1][1].length).toBeLessThan(400);
    });

    it('sem número configurado, só registra no log', async () => {
      handoff();
      await service.process(payload([text('wamid.1')]));
      expect(sender.sendText).toHaveBeenCalledTimes(1);
    });

    it('falha no aviso não derruba o atendimento', async () => {
      process.env.HANDOFF_NOTIFY_NUMBER = '5547988887777';
      handoff();
      sender.sendText.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('fora da janela'));
      await expect(service.process(payload([text('wamid.1')]))).resolves.toBeUndefined();
    });

    it('não avisa quando não houve handoff', async () => {
      process.env.HANDOFF_NOTIFY_NUMBER = '5547988887777';
      await service.process(payload([text('wamid.1')]));
      expect(sender.sendText).toHaveBeenCalledTimes(1);
    });
  });

  it('trata várias mensagens do mesmo envio, na ordem', async () => {
    await service.process(payload([text('wamid.1', 'a'), text('wamid.2', 'b')]));
    expect(chat.handleIncoming.mock.calls.map((c) => c[0].messageId)).toEqual(['wamid.1', 'wamid.2']);
  });

  it('uma falha no envio não impede as próximas mensagens', async () => {
    sender.sendText.mockRejectedValueOnce(new Error('Meta fora do ar'));
    await service.process(payload([text('wamid.1'), text('wamid.2')]));
    expect(chat.handleIncoming).toHaveBeenCalledTimes(2);
  });
});
