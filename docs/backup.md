# Backup e restauração do Postgres

## O que existe

- `infra/backup/backup.sh`: dump comprimido do banco, valida o arquivo (descarta dump vazio ou truncado), mantém 14 dias e, se `RCLONE_REMOTE` estiver definido, copia para fora do servidor.
- `infra/backup/restore.sh`: restaura um dump em um banco **vazio**. Se o banco já tiver tabelas, recusa.
- `infra/backup/mapa365-backup.{service,timer}`: agendamento diário às 03:30 pelo systemd.

**O backup só protege de verdade se sair do servidor.** O VPS é patrocinado e pode ser reposto; sem a cópia externa, perder a máquina é perder os dados. Use o rclone com qualquer storage compatível (S3, Backblaze B2, Google Drive...).

## Instalar no servidor (uma vez)

```bash
sudo cp infra/backup/mapa365-backup.service infra/backup/mapa365-backup.timer /etc/systemd/system/
# ajuste WorkingDirectory/ExecStart (caminho do projeto) e RCLONE_REMOTE no .service
sudo systemctl daemon-reload
sudo systemctl enable --now mapa365-backup.timer
systemctl list-timers mapa365-backup.timer
```

Rodar na hora e conferir: `sudo systemctl start mapa365-backup.service && journalctl -u mapa365-backup.service -n 20`.

## Restaurar

Teste a restauração de vez em quando, em um banco novo, em vez de descobrir que o backup não serve no dia do problema:

```bash
docker compose exec db createdb -U "$POSTGRES_USER" restaurado
RESTORE_DB=restaurado bash infra/backup/restore.sh /var/backups/mapa365/mapa365-AAAA-MM-DD-HHMMSS.sql.gz
```

Para recuperar de verdade em uma máquina nova: suba só o banco (`docker compose up -d db`), restaure no `POSTGRES_DB` vazio e depois suba o resto.
