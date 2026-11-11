# WhatsApp: variáveis e teste local

Fluxo: Meta → `POST /webhooks/whatsapp` (assinatura validada) → `ChatService` (banco, cota, handoff, IA) → resposta pela Cloud API.

## Variáveis de ambiente da `api`

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `WHATSAPP_VERIFY_TOKEN` | sim | Texto que você define; a Meta o envia na verificação do webhook. |
| `WHATSAPP_APP_SECRET` | sim | App Secret do app da Meta; valida a assinatura de cada chamada. Sem ele, tudo é recusado. |
| `WHATSAPP_ACCESS_TOKEN` | sim | Token permanente (usuário de sistema) para enviar respostas. |
| `WHATSAPP_PHONE_NUMBER_ID` | sim | ID do número na Cloud API. |
| `WHATSAPP_API_VERSION` | não | Versão da Graph API (padrão `v23.0`). Versões antigas são desativadas pela Meta. |
| `HANDOFF_NOTIFY_NUMBER` | não | Número que recebe o aviso quando alguém pede atendimento humano. |
| `GEMINI_API_KEY` | sim | Chave do Gemini, só no servidor. |
| `GEMINI_MODEL` | não | Padrão `gemini-2.5-flash`. |
| `DAILY_MESSAGE_LIMIT` | não | Mensagens por contato em 24 h (padrão 30). |
| `QUOTA_MESSAGE` / `HANDOFF_MESSAGE` | não | Textos fixos de limite e de handoff. |
| `KNOWLEDGE_DIR` | não | Pasta do prompt (ver [conhecimento.md](conhecimento.md)). |

Nenhum desses valores vai para o Git; ficam no `.env` do servidor.

## Limites conhecidos

- Só mensagens de **texto** são tratadas; áudio, imagem etc. são ignorados.
- O aviso de handoff é texto livre. A Meta só aceita texto livre até 24 h depois da última mensagem do destinatário ao número; fora disso o aviso falha (fica no log). A solução é um template aprovado (tarefa #34).
- A Meta reenvia o webhook se a resposta demorar; a API responde 200 na hora e ignora mensagens repetidas pelo id.

## Teste local do fluxo completo

Sobe Postgres, a API compilada e servidores simulados do Gemini e da Meta, envia webhooks assinados e confere resposta, banco e handoff:

```bash
pnpm install
pnpm --filter @mapa365/api build
bash apps/api/test/e2e/run.sh
```
