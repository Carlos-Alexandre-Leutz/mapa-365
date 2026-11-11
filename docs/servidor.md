# Servidor (VPS): preparação e primeiro deploy

Ordem de quem coloca o MVP no ar. Os passos 1 a 3 são feitos uma vez.

## 1. Acesso e segurança

1. Crie um usuário sem privilégio para o deploy e autorize a chave pública dele (login só por chave).
2. Como root, rode `sudo bash infra/harden.sh --dry-run` para ver o que será feito e, depois, sem `--dry-run`.
3. **Em outra sessão**, teste que o login por chave funciona. Só então rode `sudo bash infra/harden.sh --ssh-lockdown`.

Firewall: só 22, 80 e 443. O Docker publica portas por conta própria e **ignora o ufw**, por isso o compose só publica o Caddy (80/443); banco e API não têm porta aberta.

## 2. Docker e o projeto

```bash
# Docker Engine + plugin compose: siga https://docs.docker.com/engine/install/ para a sua distribuição
sudo usermod -aG docker deploy
git clone https://github.com/Carlos-Alexandre-Leutz/mapa-365.git /srv/mapa365
cd /srv/mapa365
cp .env.example .env     # preencha os segredos; este arquivo nunca vai para o Git
mkdir knowledge          # prompt.md e variables.json reais (ver docs/conhecimento.md)
```

## 3. DNS e primeiro deploy

1. Crie o registro `A` de `API_DOMAIN` apontando para o IP do servidor.
2. `bash infra/deploy.sh`. O Caddy emite o certificado sozinho na primeira requisição.
3. Teste: `curl -s "https://$API_DOMAIN/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=ok"` deve responder `ok`.
4. Configure o webhook na Meta com `https://$API_DOMAIN/webhooks/whatsapp` e o mesmo token.

## 4. Deploy automático (GitHub Actions)

Em Settings > Secrets and variables > Actions, ambiente `production`, crie: `VPS_HOST`, `VPS_USER`, `VPS_APP_DIR` (`/srv/mapa365`), `VPS_SSH_KEY` (chave **privada** só para o deploy) e `VPS_KNOWN_HOSTS` (saída de `ssh-keyscan -t ed25519 IP`). A partir daí, todo merge na `main` com testes verdes faz o deploy.

## 5. Depois

- Backup diário com cópia externa: [backup.md](backup.md).
- Variáveis do WhatsApp: [whatsapp.md](whatsapp.md).
