# Mapa 365

Plataforma do curso "O Mapa do Desenvolvedor de Alta Performance": uma IA que atende no site e no WhatsApp e, depois, a área logada com a trilha de 365 dias (`/arealogada`).

## Estrutura

```
apps/
  web/   Next.js: site/área logada
  bff/   NestJS + Fastify: borda para o navegador (CORS, limites de uso)
  api/   NestJS + Prisma: usuários, conversas, webhooks, regras de negócio
```

Fluxo: `web → bff → api → Postgres`. Webhooks de serviços externos (WhatsApp, Hotmart) entram direto na `api`.

## Rodando localmente

Pré-requisito: Docker.

```bash
cp .env.example .env   # preencha a senha do banco
docker compose -f docker-compose.dev.yml up --build
```

- Web: http://localhost:3000
- BFF: http://localhost:3001 (Swagger em `/docs`)
- API: http://localhost:3002

O Postgres só aceita conexões de `127.0.0.1`.

## Produção

`docker-compose.yml` expõe apenas `web` e `bff`, e só em `127.0.0.1`, para um proxy HTTPS na frente. O banco e a `api` não têm porta aberta para fora. Todas as credenciais vêm do `.env`.

## Documentação

- [Base de conhecimento da IA](docs/conhecimento.md)
- [WhatsApp: variáveis e teste local](docs/whatsapp.md)
- [Servidor: preparação e primeiro deploy](docs/servidor.md)
- [Backup e restauração](docs/backup.md)
