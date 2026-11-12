#!/bin/bash
set -e
DOCKER_USER="${1:-}"
if [ -z "$DOCKER_USER" ]; then
  echo "Usage: ./scripts/build-and-push.sh <docker-username>"
  exit 1
fi
# The SPAs call the API on its own domain. Without these build args the web app calls moxic.co/api,
# gets index.html back and crashes on load (happened 2026-11-12).
WEB_API_URL="${WEB_API_URL:-https://api.moxic.co/api}"
ADMIN_API_URL="${ADMIN_API_URL:-https://api.moxic.co}"
echo "=== Building & Pushing (web → $WEB_API_URL, admin → $ADMIN_API_URL) ==="
docker build -f Dockerfile.api -t $DOCKER_USER/moxic-api:latest . && docker push $DOCKER_USER/moxic-api:latest
docker build -f Dockerfile.web --build-arg VITE_API_URL=$WEB_API_URL -t $DOCKER_USER/moxic-web:latest . && docker push $DOCKER_USER/moxic-web:latest
docker build -f Dockerfile.admin --build-arg VITE_API_URL=$ADMIN_API_URL -t $DOCKER_USER/moxic-admin:latest . && docker push $DOCKER_USER/moxic-admin:latest
echo "=== Done ==="
