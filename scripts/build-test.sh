#!/bin/bash
# Build & push test images with VITE_API_URL pointing to server IP
# Usage: ./scripts/build-test.sh <docker-username> <server-ip>

set -e
DOCKER_USER="${1:-}"
SERVER_IP="${2:-34.158.54.48}"

if [ -z "$DOCKER_USER" ]; then
  echo "Usage: ./scripts/build-test.sh <docker-username> [server-ip]"
  exit 1
fi

API_URL="http://${SERVER_IP}:8080"
echo "=== Building test images (API_URL=${API_URL}) ==="

docker build -f Dockerfile.api -t $DOCKER_USER/moxic-api:test .
docker push $DOCKER_USER/moxic-api:test

docker build -f Dockerfile.web --build-arg VITE_API_URL=${API_URL} -t $DOCKER_USER/moxic-web:test .
docker push $DOCKER_USER/moxic-web:test

docker build -f Dockerfile.admin --build-arg VITE_API_URL=${API_URL} -t $DOCKER_USER/moxic-admin:test .
docker push $DOCKER_USER/moxic-admin:test

echo "=== Done ==="
echo "Run on server:"
echo "  export DOCKER_USER=${DOCKER_USER}"
echo "  export DOCKER_PASSWORD=<token>"
echo "  echo \"\$DOCKER_PASSWORD\" | docker login -u \"\$DOCKER_USER\" --password-stdin"
echo "  curl -o docker-compose.test.yml https://raw.githubusercontent.com/.../docker-compose.test.yml"
echo "  docker compose -f docker-compose.test.yml pull"
echo "  docker compose -f docker-compose.test.yml up -d"
