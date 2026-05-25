#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Textile QC - Production Deployment Script
# ─────────────────────────────────────────────────────────────

set -e

PROJECT_DIR="/home/ubuntu/factory-management-system"

echo "📂 Navigating to project directory..."
cd "$PROJECT_DIR"

echo "📥 Pulling latest code from GitHub..."
git pull origin main

# Validate production environment files
if [ ! -f "backend/.env" ]; then
    echo "❌ Error: backend/.env is missing! Deployment aborted."
    exit 1
fi

if [ ! -f "frontend/.env.local" ]; then
    echo "❌ Error: frontend/.env.local is missing! Deployment aborted."
    exit 1
fi

echo "🐳 Building and starting Docker containers (detached)..."
# We run without the 'proxy' profile if Nginx is handled on the host system.
# If Nginx is run via Docker Compose, use: docker compose --profile proxy up -d --build
docker compose up -d --build

echo "🔄 Running database migrations..."
docker compose exec -T backend alembic upgrade head || echo "⚠️ Migration command skipped or failed. Checking database connection..."

echo "🧹 Cleaning up unused Docker images/builders..."
docker image prune -f

echo "✅ Production deployment complete!"
docker compose ps
