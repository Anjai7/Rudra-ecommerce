#!/usr/bin/env bash
# ============================================================
# Setup Script — New Developer Onboarding
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 E-Commerce Platform — Setup${NC}"
echo "================================"

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}❌ $1 is not installed${NC}"
    return 1
  fi
  echo -e "${GREEN}✅ $1 found: $($1 --version 2>&1 | head -1)${NC}"
}

check_command node || { echo "Install Node.js 20+: https://nodejs.org"; exit 1; }
check_command pnpm || { echo "Install pnpm: npm i -g pnpm"; exit 1; }
check_command docker || { echo "Install Docker: https://docs.docker.com/get-docker/"; exit 1; }
check_command docker-compose 2>/dev/null || check_command "docker compose" 2>/dev/null || echo -e "${YELLOW}⚠ Docker Compose not found (optional)${NC}"

# Check Node version
NODE_MAJOR=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo -e "${RED}❌ Node.js 20+ required (found: $(node -v))${NC}"
  exit 1
fi

# Create .env if missing
echo -e "\n${YELLOW}Setting up environment...${NC}"
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${GREEN}✅ Created .env from .env.example${NC}"
  echo -e "${YELLOW}⚠  Please edit .env and fill in your API keys${NC}"
else
  echo -e "${GREEN}✅ .env already exists${NC}"
fi

# Install dependencies
echo -e "\n${YELLOW}Installing dependencies...${NC}"
pnpm install

# Start infrastructure
echo -e "\n${YELLOW}Starting Docker services...${NC}"
docker compose -f infra/docker/docker-compose.yml up -d

# Wait for Postgres
echo -e "\n${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
for i in {1..30}; do
  if docker exec ecommerce-postgres pg_isready -U postgres &>/dev/null; then
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
    break
  fi
  sleep 1
done

# Run migrations and seed
echo -e "\n${YELLOW}Running database migrations...${NC}"
pnpm db:generate
pnpm db:migrate

echo -e "\n${YELLOW}Seeding database...${NC}"
pnpm db:seed

echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit .env and add your Supabase/Razorpay keys"
echo "  2. Run: pnpm dev"
echo "  3. API:  http://localhost:4000/api/docs"
echo "  4. Web:  http://localhost:3000"
echo ""
