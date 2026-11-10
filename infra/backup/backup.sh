#!/usr/bin/env bash
# Backup diário do Postgres: dump comprimido local + cópia para fora do servidor (se RCLONE_REMOTE estiver definido).
# Roda NO SERVIDOR, na pasta do projeto (onde está o docker-compose.yml e o .env).
#   BACKUP_DIR     pasta dos dumps (padrão /var/backups/mapa365)
#   KEEP_DAYS      quantos dias manter localmente (padrão 14)
#   RCLONE_REMOTE  destino externo, ex.: meubucket:mapa365 (opcional; precisa do rclone configurado)
set -euo pipefail
cd "$(dirname "$0")/../.."

BACKUP_DIR="${BACKUP_DIR:-/var/backups/mapa365}"
KEEP_DAYS="${KEEP_DAYS:-14}"
set -a; . ./.env; set +a

mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/mapa365-$(date +%Y-%m-%d-%H%M%S).sql.gz"
tmp="$file.partial"
trap 'rm -f "$tmp"' EXIT

docker compose exec -T db pg_dump -U "$POSTGRES_USER" --no-owner "$POSTGRES_DB" | gzip > "$tmp"

# Um dump vazio ou truncado não pode passar por backup válido.
if ! gzip -t "$tmp" || [ "$(gzip -dc "$tmp" | grep -c 'PostgreSQL database dump complete')" -lt 1 ]; then
  rm -f "$tmp"
  echo "ERRO: dump inválido, backup descartado" >&2
  exit 1
fi
mv "$tmp" "$file"
echo "backup ok: $file ($(du -h "$file" | cut -f1))"

find "$BACKUP_DIR" -name 'mapa365-*.sql.gz' -mtime +"$KEEP_DAYS" -delete

if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$file" "$RCLONE_REMOTE"
  echo "copiado para $RCLONE_REMOTE"
else
  echo "AVISO: RCLONE_REMOTE não definido; o backup ficou só neste servidor" >&2
fi
