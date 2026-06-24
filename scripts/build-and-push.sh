#!/bin/bash
set -e
DOCKER_USER="${1:-}"
if [ -z "$DOCKER_USER" ]; then
  echo "Usage: ./scripts/build-and-push.sh <docker-username>"
  exit 1
fi
echo "=== Building & Pushing ==="
docker build -f Dockerfile.api -t $DOCKER_USER/moxic-api:latest . && docker push $DOCKER_USER/moxic-api:latest
docker build -f Dockerfile.web -t $DOCKER_USER/moxic-web:latest . && docker push $DOCKER_USER/moxic-web:latest
docker build -f Dockerfile.admin -t $DOCKER_USER/moxic-admin:latest . && docker push $DOCKER_USER/moxic-admin:latest
echo "=== Done ==="
