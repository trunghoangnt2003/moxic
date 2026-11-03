#!/bin/bash
# setup-server.sh — Khởi tạo Moxic GameStore trên Linux server lần đầu
# Chạy script này SAU KHI đã scp .env, docker-compose.yml, nginx conf lên server.
#
# Usage:
#   scp .env.production root@<IP>:/opt/moxic/.env
#   scp docker-compose.prod.yml root@<IP>:/opt/moxic/docker-compose.yml
#   scp nginx/moxic.conf root@<IP>:/opt/moxic/nginx/moxic.conf
#   ssh root@<IP> "bash -s" < scripts/setup-server.sh
#
# Hoặc copy lên server rồi chạy:
#   scp scripts/setup-server.sh root@<IP>:/opt/moxic/
#   ssh root@<IP> /opt/moxic/setup-server.sh

set -euo pipefail

BASE_DIR="/opt/moxic"
NGINX_CONF="$BASE_DIR/nginx/moxic.conf"
COMPOSE_FILE="$BASE_DIR/docker-compose.yml"
ENV_FILE="$BASE_DIR/.env"

echo "=== Moxic Server Setup ==="
echo "Base dir: $BASE_DIR"
echo ""

# Kiểm tra các file cần thiết
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found."
    echo "Run: scp .env.production root@<IP>:$ENV_FILE"
    exit 1
fi
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "ERROR: $COMPOSE_FILE not found."
    exit 1
fi
if [ ! -f "$NGINX_CONF" ]; then
    echo "ERROR: $NGINX_CONF not found."
    exit 1
fi

# 1. Kiểm tra Docker
echo "[1/5] Checking Docker installation..."
if ! command -v docker &>/dev/null; then
    echo "Installing Docker..."
    apt update
    apt install -y docker.io docker-compose-v2
    systemctl enable --now docker
fi
echo "  Docker OK: $(docker --version)"

# 2. Load Docker Hub credentials từ biến môi trường (DOCKER_PASSWORD)
echo "[2/5] Docker Hub login..."
DOCKER_USER=$(grep -oP '^DOCKER_USERNAME=\K.*' "$ENV_FILE" 2>/dev/null || echo "")
if [ -z "$DOCKER_USER" ]; then
    # Fallback: lấy từ biến môi trường hoặc mặc định
    DOCKER_USER="${DOCKER_USER-trungdocker123}"
fi

if [ -n "${DOCKER_PASSWORD-}" ]; then
    echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USER" --password-stdin
    echo "  Docker Hub logged in as $DOCKER_USER"
else
    echo "  WARNING: DOCKER_PASSWORD not set. Run manually:"
    echo "    echo \"\$DOCKER_PASSWORD\" | docker login -u \"$DOCKER_USER\" --password-stdin"
fi

# 3. Tạo thư mục certs
echo "[3/5] Setting up directories..."
mkdir -p "$BASE_DIR/certs"

# 4. Pull images
echo "[4/5] Pulling images..."
cd "$BASE_DIR"
docker compose pull
echo "  Pull done"

# 5. Start stack
echo "[5/5] Starting services..."
docker compose up -d
echo ""

# Kiểm tra
echo "=== Status ==="
docker compose ps
echo ""

echo "=== Testing API ==="
sleep 3 # Đợi API khởi động
curl -sf http://localhost:8080/api/games --max-time 5 && echo "" || echo "  API not ready yet — check with: docker compose logs moxic-api"

echo ""
echo "=== Setup Complete ==="
echo "Domains:"
echo "  Store:    https://moxic.co"
echo "  Admin:    https://admin.moxic.co"
echo "  API:      https://api.moxic.co"
echo "  MinIO:    https://minio.moxic.co"
echo ""
echo "Quick commands:"
echo "  docker compose logs -f          # Xem logs"
echo "  docker compose restart moxic-api # Restart API"
echo "  docker exec -it moxic-postgres psql -U moxic -d moxic  # DB console"
