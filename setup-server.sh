#!/bin/bash
# HestiOS — Initial Hetzner server setup
# Run once as root on a fresh Ubuntu 24.04 server
# Usage: ssh root@<SERVER_IP> "bash <(curl -s https://...)"
# OR: scp this file to server then: bash setup-server.sh

set -e

echo "=== HestiOS Server Setup ==="

# ── System update ─────────────────────────────────────────────────────────────
apt-get update && apt-get upgrade -y

# ── Install Docker ────────────────────────────────────────────────────────────
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# ── Install git ───────────────────────────────────────────────────────────────
apt-get install -y git

# ── Firewall ──────────────────────────────────────────────────────────────────
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 9000/tcp   # MinIO S3 API (for presigned URLs)
# ufw allow 9001/tcp # MinIO console — only open temporarily when needed
ufw --force enable

# ── Clone repo ────────────────────────────────────────────────────────────────
mkdir -p /opt/hestios
cd /opt/hestios

# IMPORTANT: Set up SSH key or use HTTPS with token
# git clone git@github.com:YOUR_ORG/hestios.git .
echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Clone your repo:  git clone <URL> /opt/hestios"
echo "  2. Copy env file:    cp /opt/hestios/.env.prod.example /opt/hestios/.env.prod"
echo "  3. Edit secrets:     nano /opt/hestios/.env.prod"
echo "  4. Run deploy:       bash /opt/hestios/deploy.sh"
echo ""
echo "Generate SECRET_KEY:"
echo "  python3 -c \"import secrets; print(secrets.token_hex(32))\""
