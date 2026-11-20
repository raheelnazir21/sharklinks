#!/usr/bin/env bash
set -e

PROJECT_DIR="/Users/tronyx/Desktop/Sharklinks"
cd "$PROJECT_DIR"

# Kill existing processes on port 8000 and 3000 if any
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start backend
cd "$PROJECT_DIR/backend"
nohup ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "$PROJECT_DIR/backend.log" 2>&1 &
echo "Backend running on http://127.0.0.1:8000"

# Sync static assets for standalone Next.js server
mkdir -p "$PROJECT_DIR/frontend/.next/standalone/.next"
cp -r "$PROJECT_DIR/frontend/public" "$PROJECT_DIR/frontend/.next/standalone/" 2>/dev/null || true
cp -r "$PROJECT_DIR/frontend/.next/static" "$PROJECT_DIR/frontend/.next/standalone/.next/" 2>/dev/null || true

# Start frontend
cd "$PROJECT_DIR/frontend/.next/standalone"
nohup env PORT=3000 node server.js > "$PROJECT_DIR/frontend.log" 2>&1 &
echo "Frontend running on http://127.0.0.1:3000"
