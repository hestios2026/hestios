#!/bin/bash
# HestiOS — Production deploy script
# Run on the Hetzner server as root or sudo user
# Usage: ./deploy.sh

set -e

DOMAIN="erp.hesti-rossmann.de"
EMAIL="admin@hesti-rossmann.de"   # ← change to your email for Let's Encrypt
APP_DIR="/opt/hestios"

echo "=== HestiOS Deploy ==="

# ── 1. Pull latest code ───────────────────────────────────────────────────────
cd "$APP_DIR"
git pull origin main

# ── 2. Ensure .env.prod exists ────────────────────────────────────────────────
if [ ! -f .env.prod ]; then
  echo "ERROR: .env.prod not found. Copy .env.prod.example and fill in secrets."
  exit 1
fi

# Load DOMAIN from .env.prod for docker-compose
export $(grep -E '^DOMAIN=|^MINIO_ACCESS_KEY=|^MINIO_SECRET_KEY=|^POSTGRES_USER=|^POSTGRES_PASSWORD=' .env.prod | xargs)

# ── 3. Build & start services (without nginx first, for initial SSL) ──────────
cd docker
docker compose -f docker-compose.prod.yml build --no-cache backend frontend
docker compose -f docker-compose.prod.yml up -d postgres redis minio backend frontend

echo "Waiting for backend to start..."
sleep 8

# ── 4. Run production seed (first deploy only) ────────────────────────────────
SEED_FLAG="$APP_DIR/.seed_done"
if [ ! -f "$SEED_FLAG" ]; then
  echo "=== Running production seed ==="
  docker compose -f docker-compose.prod.yml exec -T backend python seed_prod.py
  touch "$SEED_FLAG"
  echo "Seed complete."
fi

# ── 5. Get SSL certificate (only needed on first deploy) ──────────────────────
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "=== Getting SSL certificate ==="

  # Start nginx in HTTP-only mode for certbot challenge
  docker run --rm -d --name nginx-temp \
    -p 80:80 \
    -v /opt/hestios/docker/nginx/nginx-temp.conf:/etc/nginx/conf.d/default.conf:ro \
    -v certbot_www:/var/www/certbot \
    nginx:1.25-alpine

  docker run --rm \
    -v /etc/letsencrypt:/etc/letsencrypt \
    -v certbot_www:/var/www/certbot \
    certbot/certbot certonly \
      --webroot \
      --webroot-path=/var/www/certbot \
      --email "$EMAIL" \
      --agree-tos \
      --no-eff-email \
      -d "$DOMAIN"

  docker stop nginx-temp
  echo "SSL certificate obtained."
fi

# ── 6. Start nginx + certbot renewal ─────────────────────────────────────────
docker compose -f docker-compose.prod.yml up -d nginx certbot

echo ""
echo "=== Deploy complete ==="
echo "Frontend: https://$DOMAIN"
echo "API:      https://$DOMAIN/api/"
echo "MinIO:    http://$DOMAIN:9000  (console: http://$DOMAIN:9001)"
echo ""
echo "To view logs: docker compose -f docker/docker-compose.prod.yml logs -f"
