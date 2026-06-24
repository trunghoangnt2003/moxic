#!/bin/bash
set -e
SERVER_IP="34.158.54.48"
SSH_USER="${1:-root}"
if [ -z "$DOCKER_USERNAME" ]; then
  echo "Error: DOCKER_USERNAME not set"
  exit 1
fi
ssh $SSH_USER@$SERVER_IP "mkdir -p /opt/moxic/nginx"
scp .env.production $SSH_USER@$SERVER_IP:/opt/moxic/.env
scp docker-compose.prod.yml $SSH_USER@$SERVER_IP:/opt/moxic/docker-compose.yml
scp nginx/moxic.conf $SSH_USER@$SERVER_IP:/opt/moxic/nginx/moxic.conf
ssh $SSH_USER@$SERVER_IP << 'ENDSSH'
  cd /opt/moxic
  echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
  docker compose pull
  docker compose up -d --force-recreate
  docker image prune -f
  echo "Deploy done"
ENDSSH
