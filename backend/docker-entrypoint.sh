#!/bin/sh
set -e

echo "[entrypoint] Starting container at $(date)"
echo "[entrypoint] NODE_ENV=$NODE_ENV PORT=${PORT:-3000}"
echo "[entrypoint] Environment variables (filtered):"
env | sed -n '/SENDGRID_API_KEY\|SMTP_\|TO_EMAIL\|FROM_EMAIL/p' | sed -e 's/=.*/=****/' || true

echo "[entrypoint] Running node index.js"
exec node index.js
