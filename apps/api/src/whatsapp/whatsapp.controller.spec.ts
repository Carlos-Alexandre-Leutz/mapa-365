import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request from 'supertest';
import { WhatsappController } from './whatsapp.controller';

describe('WhatsappController - verificação do webhook', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WhatsappController],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'token-secreto';
  });

  afterEach(() => {
    delete process.env.WHATSAPP_VERIFY_TOKEN;
  });

  const verify = (query: Record<string, string>) =>
    request(app.getHttpServer()).get('/webhooks/whatsapp').query(query);

  it('devolve o challenge quando o token confere', async () => {
    const res = await verify({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'token-secreto',
      'hub.challenge': '12345',
    });
    expect(res.status).toBe(200);
    expect(res.text).toBe('12345');
  });

  it('recusa token errado', async () => {
    const res = await verify({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'outro',
      'hub.challenge': '12345',
    });
    expect(res.status).toBe(403);
  });

  it('recusa quando o modo não é subscribe', async () => {
    const res = await verify({
      'hub.mode': 'unsubscribe',
      'hub.verify_token': 'token-secreto',
      'hub.challenge': '12345',
    });
    expect(res.status).toBe(403);
  });

  it('recusa tudo se o token do servidor não estiver configurado', async () => {
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    const res = await verify({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'undefined',
      'hub.challenge': '12345',
    });
    expect(res.status).toBe(403);
  });
});

describe('WhatsappController - assinatura das mensagens', () => {
  let app: INestApplication;
  const secret = 'segredo-do-app';
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  const sign = (payload: string, key = secret) =>
    `sha256=${createHmac('sha256', key).update(payload).digest('hex')}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WhatsappController],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    process.env.WHATSAPP_APP_SECRET = secret;
  });

  afterEach(() => {
    delete process.env.WHATSAPP_APP_SECRET;
  });

  const post = (payload: string, signature?: string) => {
    const req = request(app.getHttpServer())
      .post('/webhooks/whatsapp')
      .set('content-type', 'application/json');
    if (signature) {
      req.set('x-hub-signature-256', signature);
    }
    return req.send(payload);
  };

  it('aceita uma chamada com assinatura válida', async () => {
    const res = await post(body, sign(body));
    expect(res.status).toBe(200);
    expect(res.text).toBe('EVENT_RECEIVED');
  });

  it('recusa assinatura calculada com outro segredo', async () => {
    const res = await post(body, sign(body, 'segredo-errado'));
    expect(res.status).toBe(401);
  });

  it('recusa quando o corpo foi alterado depois de assinado', async () => {
    const res = await post(body.replace('entry', 'entrx'), sign(body));
    expect(res.status).toBe(401);
  });

  it('recusa chamada sem assinatura', async () => {
    const res = await post(body);
    expect(res.status).toBe(401);
  });

  it('recusa tudo se o segredo do servidor não estiver configurado', async () => {
    delete process.env.WHATSAPP_APP_SECRET;
    const res = await post(body, sign(body));
    expect(res.status).toBe(401);
  });
});
