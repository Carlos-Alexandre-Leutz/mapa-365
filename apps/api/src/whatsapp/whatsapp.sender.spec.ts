import { WhatsappSender } from './whatsapp.sender';

describe('WhatsappSender', () => {
  const sender = new WhatsappSender();
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'token-de-teste';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '111222333';
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_API_VERSION;
    delete process.env.WHATSAPP_GRAPH_URL;
  });

  it('envia o texto pela Cloud API com o token no cabeçalho', async () => {
    await sender.sendText('5547999990000', 'Olá!');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v23.0/111222333/messages');
    expect(init.headers.authorization).toBe('Bearer token-de-teste');
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      to: '5547999990000',
      type: 'text',
      text: { body: 'Olá!' },
    });
  });

  it('usa a versão da API configurada', async () => {
    process.env.WHATSAPP_API_VERSION = 'v25.0';
    await sender.sendText('1', 'oi');
    expect(fetchMock.mock.calls[0][0]).toContain('/v25.0/');
  });

  it('aceita outro endereço da Graph API (para testes locais)', async () => {
    process.env.WHATSAPP_GRAPH_URL = 'http://127.0.0.1:9999';
    await sender.sendText('1', 'oi');
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:9999/v23.0/111222333/messages');
  });

  it('corta textos acima do limite do WhatsApp', async () => {
    await sender.sendText('1', 'a'.repeat(5000));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text.body).toHaveLength(4000);
  });

  it('falha quando a Meta recusa, sem vazar o token', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'token inválido' });
    const error = await sender.sendText('1', 'oi').catch((e: Error) => e);
    expect((error as Error).message).toContain('401');
    expect((error as Error).message).not.toContain('token-de-teste');
  });

  it('falha sem token ou sem id do número', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    await expect(sender.sendText('1', 'oi')).rejects.toThrow('não configurados');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
