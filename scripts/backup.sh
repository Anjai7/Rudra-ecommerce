#!/usr/bin/env bash
# ============================================================
# Backup Script — Database & Redis to S3
# ============================================================
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/ecommerce-backups/${TIMESTAMP}"
S3_BUCKET="${S3_BACKUP_BUCKET:-ecommerce-backups}"

mkdir -p "$BACKUP_DIR"

echo "📦 Starting backup at ${TIMESTAMP}..."

# PostgreSQL backup
echo "  💾 Backing up PostgreSQL..."
pg_dump "${DATABASE_URL}" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="${BACKUP_DIR}/postgres_${TIMESTAMP}.dump"

echo "  ✅ PostgreSQL backup: $(du -sh "${BACKUP_DIR}/postgres_${TIMESTAMP}.dump" | cut -f1)"

# Redis backup (trigger RDB save)
echo "  💾 Backing up Redis..."
redis-cli -u "${REDIS_URL}" BGSAVE
sleep 5
redis-cli -u "${REDIS_URL}" --rdb "${BACKUP_DIR}/redis_${TIMESTAMP}.rdb" 2>/dev/null || echo "  ⚠ Redis RDB download skipped (use volume backup instead)"

# Upload to S3
echo "  ☁️  Uploading to S3..."
aws s3 cp "${BACKUP_DIR}/" "s3://${S3_BUCKET}/backups/${TIMESTAMP}/" --recursive

# Cleanup old local backups
rm -rf "$BACKUP_DIR"

# Cleanup old S3 backups (keep 30 days)
echo "  🧹 Cleaning up old backups..."
aws s3 ls "s3://${S3_BUCKET}/backups/" | while read -r line; do
  BACKUP_DATE=$(echo "$line" | awk '{print $2}' | tr -d '/')
  if [[ "$BACKUP_DATE" < $(date -d '-30 days' +%Y%m%d_%H%M%S) ]]; then
    aws s3 rm "s3://${S3_BUCKET}/backups/${BACKUP_DATE}/" --recursive
  fi
done 2>/dev/null || true

echo "✅ Backup completed: s3://${S3_BUCKET}/backups/${TIMESTAMP}/"
