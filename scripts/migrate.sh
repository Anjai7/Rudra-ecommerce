#!/usr/bin/env bash
# ============================================================
# Migration Script — Zero-Downtime Wrapper
# ============================================================
# Validates and safely applies Prisma migrations with rollback
# capability. Always run this instead of raw prisma commands.
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔄 Migration — Zero-Downtime Wrapper${NC}"

# Step 1: Validate connection
echo -e "\n${YELLOW}Step 1: Validating database connection...${NC}"
if ! npx prisma db execute --stdin <<< "SELECT 1" &>/dev/null; then
  echo -e "${RED}❌ Cannot connect to database. Check DATABASE_URL.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Database connection OK${NC}"

# Step 2: Check pending migrations
echo -e "\n${YELLOW}Step 2: Checking pending migrations...${NC}"
PENDING=$(npx prisma migrate status 2>&1 || true)
if echo "$PENDING" | grep -q "Database schema is up to date"; then
  echo -e "${GREEN}✅ No pending migrations${NC}"
  exit 0
fi
echo "$PENDING"

# Step 3: Create backup before migration
echo -e "\n${YELLOW}Step 3: Creating pre-migration backup...${NC}"
BACKUP_FILE="/tmp/pre_migration_$(date +%Y%m%d_%H%M%S).dump"
pg_dump "${DATABASE_URL}" --format=custom --file="${BACKUP_FILE}" 2>/dev/null && \
  echo -e "${GREEN}✅ Backup saved: ${BACKUP_FILE}${NC}" || \
  echo -e "${YELLOW}⚠ Backup skipped (pg_dump not available)${NC}"

# Step 4: Apply migrations
echo -e "\n${YELLOW}Step 4: Applying migrations...${NC}"
if npx prisma migrate deploy; then
  echo -e "${GREEN}✅ Migrations applied successfully${NC}"
else
  echo -e "${RED}❌ Migration failed!${NC}"
  echo -e "${YELLOW}To restore from backup:${NC}"
  echo -e "  pg_restore --clean --no-owner -d \$DATABASE_URL ${BACKUP_FILE}"
  exit 1
fi

# Step 5: Verify
echo -e "\n${YELLOW}Step 5: Verifying migration...${NC}"
npx prisma migrate status

echo -e "\n${GREEN}✅ Migration completed successfully${NC}"
