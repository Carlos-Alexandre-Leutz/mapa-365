import { GeminiClient } from './gemini.client';

class FastGeminiClient extends GeminiClient {
  protected sleep(): Promise<void> {
    return Promise.resolve();
  }
}

const ok = (text: string) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  }) as Response;

const fail = (status: number) => ({ ok: false, status }) as Response;

describe('GeminiClient', () => {
  const client = new FastGeminiClient();
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'chave-de-teste';
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_BASE_URL;
  });

  it('envia prompt e histórico e devolve o texto', async () => {
    fetchMock.mockResolvedValue(ok('Oi! Tudo bem?'));

    const answer = await client.generate('sistema', [
      { role: 'user', text: 'oi' },
    ]);

    expect(answer).toBe('Oi! Tudo bem?');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('gemini-2.5-flash:generateContent');
    expect(init.headers['x-goog-api-key']).toBe('chave-de-teste');
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe('sistema');
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'oi' }] }]);
  });

  it('usa o modelo definido em GEMINI_MODEL', async () => {
    process.env.GEMINI_MODEL = 'outro-modelo';
    fetchMock.mockResolvedValue(ok('ok'));
    await client.generate('s', [{ role: 'user', text: 'oi' }]);
    expect(fetchMock.mock.calls[0][0]).toContain('outro-modelo:generateContent');
  });

  it('aceita outro endereço base (para testes locais)', async () => {
    process.env.GEMINI_BASE_URL = 'http://127.0.0.1:9999/v1beta';
    fetchMock.mockResolvedValue(ok('ok'));
    await client.generate('s', [{ role: 'user', text: 'oi' }]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:9999/v1beta/models/gemini-2.5-flash:generateContent',
    );
  });

  it('tenta de novo em 429 e 5xx', async () => {
    fetchMock
      .mockResolvedValueOnce(fail(429))
      .mockResolvedValueOnce(fail(503))
      .mockResolvedValueOnce(ok('funcionou'));

    await expect(
      client.generate('s', [{ role: 'user', text: 'oi' }]),
    ).resolves.toBe('funcionou');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('não tenta de novo em erro do cliente (4xx)', async () => {
    fetchMock.mockResolvedValue(fail(400));
    await expect(
      client.generate('s', [{ role: 'user', text: 'oi' }]),
    ).rejects.toThrow('status 400');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('desiste depois de 3 tentativas', async () => {
    fetchMock.mockResolvedValue(fail(500));
    await expect(
      client.generate('s', [{ role: 'user', text: 'oi' }]),
    ).rejects.toThrow('status 500');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('falha se a chave não estiver configurada', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(
      client.generate('s', [{ role: 'user', text: 'oi' }]),
    ).rejects.toThrow('GEMINI_API_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falha se a resposta vier vazia', async () => {
    fetchMock.mockResolvedValue(ok('   '));
    await expect(
      client.generate('s', [{ role: 'user', text: 'oi' }]),
    ).rejects.toThrow('vazia');
  });
});
