#!/usr/bin/env bash
# Fluxo completo do WhatsApp contra Postgres real, com Gemini e Meta simulados.
# Pré-requisitos: Docker, `pnpm install` feito e a API compilada (`pnpm --filter @mapa365/api build`).
# Uso, na raiz do repositório:  bash apps/api/test/e2e/run.sh
set -euo pipefail
cd "$(dirname "$0")/../../../.."
DB=postgresql://postgres:x@127.0.0.1:55433/e2e
trap 'docker rm -f e2e-api e2e-mock e2e-pg >/dev/null 2>&1 || true' EXIT
docker rm -f e2e-api e2e-mock e2e-pg >/dev/null 2>&1 || true

docker run -d --name e2e-pg -e POSTGRES_PASSWORD=x -e POSTGRES_DB=e2e -p 127.0.0.1:55433:5432 postgres:16-alpine >/dev/null
sleep 7
docker run --rm --network host -v "$PWD/apps/api/prisma:/p" -e DATABASE_URL=$DB node:22-alpine \
  sh -c "npx --yes prisma@6.4.1 migrate deploy --schema /p/schema.prisma" >/dev/null
docker run -d --name e2e-mock --network host node:22-alpine node -e "$(cat apps/api/test/e2e/mock-apis.js)" >/dev/null
docker run -d --name e2e-api --network host -u "$(id -u):$(id -g)" -v "$PWD":/app -w /app/apps/api \
  -e PORT=3902 -e DATABASE_URL=$DB -e GEMINI_API_KEY=fake -e GEMINI_BASE_URL=http://127.0.0.1:55999/v1beta \
  -e WHATSAPP_VERIFY_TOKEN=tok -e WHATSAPP_APP_SECRET=segredo -e WHATSAPP_ACCESS_TOKEN=tokenfake \
  -e WHATSAPP_PHONE_NUMBER_ID=111 -e WHATSAPP_GRAPH_URL=http://127.0.0.1:55999 \
  -e HANDOFF_NOTIFY_NUMBER=5547988887777 -e KNOWLEDGE_DIR=/app/apps/api/knowledge.example \
  node:22-alpine node dist/main >/dev/null
sleep 6

fail=0
check() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FALHA $1 (esperado '$3', veio '$2')"; fail=1; fi; }
sign() { printf '%s' "$1" | openssl dgst -sha256 -hmac segredo | sed 's/^.* //'; }
hook() {
  local body='{"entry":[{"changes":[{"value":{"contacts":[{"wa_id":"5547999990000","profile":{"name":"Maria"}}],"messages":[{"from":"5547999990000","id":"'$1'","type":"text","text":{"body":"'$2'"}}]}}]}]}'
  curl -s -o /dev/null -w "%{http_code}" -X POST 127.0.0.1:3902/webhooks/whatsapp -H 'content-type: application/json' \
    -H "x-hub-signature-256: sha256=$(sign "$body")" -d "$body"
}
count() { curl -s 127.0.0.1:55999/_log | python3 -c "import sys,json;print(sum(1 for e in json.load(sys.stdin) if e['to']=='$1'))"; }
rows() { docker exec e2e-pg psql -U postgres -d e2e -At -c "$1"; }

check "verificação com token certo"   "$(curl -s '127.0.0.1:3902/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=abc')" abc
check "verificação com token errado"  "$(curl -s -o /dev/null -w '%{http_code}' '127.0.0.1:3902/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=x&hub.challenge=abc')" 403
check "POST sem assinatura"           "$(curl -s -o /dev/null -w '%{http_code}' -X POST 127.0.0.1:3902/webhooks/whatsapp -H 'content-type: application/json' -d '{}')" 401

check "mensagem 1 aceita"             "$(hook wamid.1 'oi, quero saber do curso')" 200; sleep 2
check "reenvio da mesma mensagem"     "$(hook wamid.1 'oi, quero saber do curso')" 200; sleep 2
check "IA chamada uma única vez"      "$(count gemini)" 1
check "uma resposta enviada"          "$(count meta)" 1
check "mensagem 2 aceita"             "$(hook wamid.2 'tenho dificuldade')" 200; sleep 2
check "pedido de humano"              "$(hook wamid.3 'quero falar com o Alexandre')" 200; sleep 2
check "handoff marcado no banco"      "$(rows 'select "humanTakeover" from "Conversation"')" t
check "responsável avisado"           "$(curl -s 127.0.0.1:55999/_log | python3 -c "import sys,json;print(sum(1 for e in json.load(sys.stdin) if e['to']=='meta' and e['number']=='5547988887777'))")" 1
before=$(count meta)
check "mensagem depois do handoff"    "$(hook wamid.4 'alguém aí?')" 200; sleep 2
check "IA em silêncio após handoff"   "$(count meta)" "$before"
check "mensagens guardadas"           "$(rows 'select count(*) from "Message"')" 7

[ $fail = 0 ] && echo "TUDO OK" || { echo "HÁ FALHAS"; exit 1; }
