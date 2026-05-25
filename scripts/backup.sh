#!/bin/bash
# ─────────────────────────────────────────────────────────────
# PostgreSQL Nightly Backup Script
# Schedule with cron: 0 2 * * * /path/to/backup.sh
# ─────────────────────────────────────────────────────────────

BACKUP_DIR="/app/backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
DB_NAME="${POSTGRES_DB:-textile_db}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${DB_HOST:-db}"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "📦 Starting backup: $BACKUP_FILE"
pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup completed: $BACKUP_FILE"
else
    echo "❌ Backup FAILED!"
    exit 1
fi

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
echo "🗑️  Old backups cleaned up (>30 days)"
