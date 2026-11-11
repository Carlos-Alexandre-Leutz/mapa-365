#!/usr/bin/env bash
# Endurecimento básico de um servidor Ubuntu/Debian NOVO. Rode NO SERVIDOR, como root (sudo).
# Idempotente: pode rodar de novo sem estragar nada.
#
#   --dry-run        só mostra o que faria
#   --ssh-lockdown   desliga login por senha e login de root no SSH. Só use depois de testar,
#                    em OUTRA sessão, que o login por chave funciona: errar aqui tranca você para fora.
set -euo pipefail

DRY=0; LOCKDOWN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --ssh-lockdown) LOCKDOWN=1 ;;
    *) echo "opção desconhecida: $arg" >&2; exit 2 ;;
  esac
done

run() { if [ "$DRY" = 1 ]; then echo "[dry-run] $*"; else "$@"; fi; }

if [ "$DRY" = 0 ] && [ "$(id -u)" != 0 ]; then
  echo "Rode como root (sudo bash infra/harden.sh)." >&2
  exit 1
fi

# Porta do SSH em uso, para não bloquear a própria sessão.
SSH_PORT=$(awk 'tolower($1)=="port"{print $2; exit}' /etc/ssh/sshd_config 2>/dev/null || true)
SSH_PORT=${SSH_PORT:-22}

echo "==> Pacotes"
run apt-get update -qq
run env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ufw fail2ban unattended-upgrades

echo "==> Firewall (ufw): só SSH ($SSH_PORT), 80 e 443"
run ufw default deny incoming
run ufw default allow outgoing
run ufw allow "$SSH_PORT"/tcp
run ufw allow 80/tcp
run ufw allow 443/tcp
run ufw --force enable

echo "==> Atualizações automáticas de segurança"
if [ "$DRY" = 1 ]; then
  echo "[dry-run] escrever /etc/apt/apt.conf.d/20auto-upgrades"
else
  printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > /etc/apt/apt.conf.d/20auto-upgrades
fi

echo "==> fail2ban no SSH"
run systemctl enable --now fail2ban

if [ "$LOCKDOWN" = 1 ]; then
  echo "==> SSH: sem senha e sem root"
  if [ "$DRY" = 1 ]; then
    echo "[dry-run] exigir ao menos uma chave em authorized_keys, escrever /etc/ssh/sshd_config.d/99-mapa365.conf, validar com sshd -t e recarregar"
  else
    keys=$(cat /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys 2>/dev/null | grep -c '^ssh-\|^ecdsa-\|^sk-' || true)
    if [ "$keys" -lt 1 ]; then
      echo "ERRO: nenhuma chave em authorized_keys. Abortando para não trancar você para fora." >&2
      exit 1
    fi
    printf 'PasswordAuthentication no\nPermitRootLogin no\nKbdInteractiveAuthentication no\n' > /etc/ssh/sshd_config.d/99-mapa365.conf
    if ! sshd -t; then
      rm -f /etc/ssh/sshd_config.d/99-mapa365.conf
      echo "ERRO: configuração do SSH inválida; revertido." >&2
      exit 1
    fi
    systemctl reload ssh || systemctl reload sshd
  fi
else
  echo "==> SSH: não alterado (use --ssh-lockdown depois de testar o login por chave)"
fi

echo "Pronto. Confira com: ufw status verbose && systemctl status fail2ban --no-pager"
