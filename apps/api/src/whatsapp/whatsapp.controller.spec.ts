import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { WhatsappController } from './whatsapp.controller';

describe('WhatsappController - verificação do webhook', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WhatsappController],
    }).compile();
    app = moduleRef.createNestApplication();
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
