#!/usr/bin/env bash
# Full project setup: install deps, configure .env, create DB directory, seed, and start.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 1/4 Installing dependencies ==="
npm install

echo ""
echo "=== 2/4 Configuring environment ==="
ENV_FILE="apps/api/.env"
ENV_EXAMPLE="apps/api/.env.example"

if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "Created $ENV_FILE from .env.example"
  echo "⚠  Edit $ENV_FILE and add your OPENAI_API_KEY before using the AI chat."
else
  echo "$ENV_FILE already exists, skipping."
fi

echo ""
echo "=== 3/4 Seeding database ==="
mkdir -p apps/api/data
npm run seed

echo ""
echo "=== 4/4 Starting app (API :3001, Web :3000) ==="
npm run dev
