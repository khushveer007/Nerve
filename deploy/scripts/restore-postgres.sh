#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/srv/nerve/app}"
SHARED_ENV_FILE="${SHARED_ENV_FILE:-/srv/nerve/shared/env/.env}"
BACKUP_FILE="${1:-}"
TARGET_DB="${2:-${POSTGRES_DB:-nerve}}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: restore-postgres.sh /path/to/backup.sql.gz [target_db]" >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup not found: $BACKUP_FILE" >&2
  exit 1
fi

set -a
source "$SHARED_ENV_FILE"
set +a

gunzip -c "$BACKUP_FILE" | docker compose --env-file "$SHARED_ENV_FILE" -f "$APP_ROOT/docker-compose.yml" exec -T db \
  psql -U "$POSTGRES_USER" -d "$TARGET_DB"

echo "Restore completed into database: $TARGET_DB"
