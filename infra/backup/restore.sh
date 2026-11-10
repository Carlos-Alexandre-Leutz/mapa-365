#!/usr/bin/env bash
# Restaura um dump em um banco VAZIO. Não apaga nada: se o banco já tiver tabelas, para.
# Uso: bash infra/backup/restore.sh /var/backups/mapa365/mapa365-AAAA-MM-DD-HHMMSS.sql.gz
# RESTORE_DB=outro_banco restaura em outro banco vazio (crie antes: createdb) em vez do POSTGRES_DB.
set -euo pipefail
cd "$(dirname "$0")/../.."
file="${1:?informe o arquivo .sql.gz}"
set -a; . ./.env; set +a
POSTGRES_DB="${RESTORE_DB:-$POSTGRES_DB}"

tables=$(docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c \
  "select count(*) from information_schema.tables where table_schema='public'")
if [ "$tables" != "0" ]; then
  echo "ERRO: o banco $POSTGRES_DB já tem $tables tabelas. Restaure em um banco novo (veja docs/backup.md)." >&2
  exit 1
fi
gzip -dc "$file" | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q
echo "restaurado: $file"
