#!/usr/bin/env bash
# Roda NO SERVIDOR, dentro da pasta do projeto: atualiza o código, reconstrói, migra o banco e sobe.
# Chamado pelo GitHub Actions (ver .github/workflows/deploy.yml) ou à mão: bash infra/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch --quiet origin main
git merge --ff-only origin/main

docker compose build
# Se a migration falhar, o script para aqui e os containers antigos continuam no ar.
docker compose --profile tools run --rm migrate
docker compose up -d --remove-orphans

docker image prune -f >/dev/null
docker compose ps
