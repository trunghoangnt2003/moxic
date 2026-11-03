# Deployment Guide — Moxic GameStore

**Date:** 2026-06-25
**Status:** Draft

## Overview

Streamlined deployment pipeline: **Build on Windows → Push to Docker Hub → Pull & run on Linux server**.
All internal services communicate via Docker network. Nginx is the single entry point for all domains.

## Architecture

```
User → DNS (Cloudflare)
         ↓
    Server :80/:443
         ↓
      Nginx (proxy_pass)
      /    |     \       \
moxic-web moxic-admin moxic-api minio:9000
     |         |         |        |
  :3001      :3002     :8080    :9000
         postgres:5432
```

### Nginx routing
| Domain | Target | Type |
|--------|--------|------|
| `moxic.co` + `www.moxic.co` | moxic-web:80 | SPA |
| `admin.moxic.co` | moxic-admin:80 | SPA |
| `api.moxic.co` | moxic-api:8080 | API |
| `minio.moxic.co` | minio:9000 | Object storage |

All domains terminate SSL at Nginx (or Cloudflare). No port exposure to internet except 80/443.

## Services

### Pre-built images (Docker Hub)
All images are built on Windows and pushed to Docker Hub. Server only pulls:

| Image | Source |
|-------|--------|
| `trungdocker123/moxic-api:latest` | Moxic.Api .NET 10 |
| `trungdocker123/moxic-web:latest` | Moxic.Web (React SPA) |
| `trungdocker123/moxic-admin:latest` | Moxic.Admin (React SPA) |

### Infrastructure images (pulled from registry)
| Image | Purpose |
|-------|---------|
| `postgres:16-alpine` | Database |
| `minio/minio:latest` | Object storage |
| `minio/mc:latest` | Bucket init |
| `nginx:alpine` | Reverse proxy |

## Configuration

### Environment variables
All secrets and service addresses live in `.env` file on server (not in repo, not baked into images).

| Variable | Example | Used by |
|----------|---------|---------|
| `DB_NAME` | moxic | postgres, api |
| `DB_USER` | moxic | postgres, api |
| `DB_PASSWORD` | (secret) | postgres, api |
| `MINIO_USER` | moxicadmin | minio, api |
| `MINIO_PASSWORD` | (secret) | minio, api |
| `SMTP_USERNAME` | moxmoz29@gmail.com | api |
| `SMTP_PASSWORD` | (secret) | api |
| `SMTP_ADMIN_EMAIL` | moxmoz29@gmail.com | api |
| `CORS_ORIGINS` | https://moxic.co,https://admin.moxic.co | api |
| `DOCKER_USERNAME` | trungdocker123 | build script |

### Compose env resolution
`docker-compose.prod.yml` reads from `.env` via `${VAR:-default}` syntax.
API container receives env vars as `Minio__PublicEndpoint=minio.moxic.co` etc.

### Frontend API URL
- Built into image via `VITE_API_URL` build arg
- Admin: `https://api.moxic.co`
- Web: `https://api.moxic.co`

### SSL
- **Option A**: Cloudflare Full (Strict) — DNS proxied, cert from Cloudflare
- **Option B**: Let's Encrypt certbot on server — mount into `/etc/nginx/certs/`

## Deployment workflow

### Phase 1: Initial server setup (one-time)
1. Install Docker + Docker Compose on Linux
2. Create `/opt/moxic/` directory
3. Copy `.env` with secrets (scp from local or create via SSH)
4. Copy `docker-compose.prod.yml` and `nginx/moxic.conf`
5. Get SSL certs
6. `docker compose up -d`

### Phase 2: Regular deploy (repeatable)
```
Windows: .\scripts\deploy.ps1
  → build 3 images
  → push to Docker Hub

Linux:
  → docker compose pull
  → docker compose up -d --force-recreate
```

## Build script (Windows PowerShell)

Single script `scripts/deploy.ps1`:
- Reads `DOCKER_USERNAME` from `.env.production`
- Builds `moxic-api`, `moxic-web` (with `VITE_API_URL`), `moxic-admin` (with `VITE_API_URL`)
- Tags as `:latest`
- Pushes all images
- Outputs the SSH commands to run on server

## Server setup script

Single script `scripts/setup-server.sh` to be scp'd and run once:
- Creates `/opt/moxic/` directory structure
  - No `.env` prompt — reads from scp'd file
- No cert provisioning (add manually or via certbot)
- Pulls images + starts stack

## Files to create / modify

| File | Action |
|------|--------|
| `scripts/deploy.ps1` | **New** — build & push on Windows |
| `scripts/setup-server.sh` | **New** — initial server setup |
| `docker-compose.prod.yml` | **Modify** — use `image:` instead of `build:`, fix MinIO healthcheck dep |
| `.env.production` → `.env` | **Copy** — rename on server, add as git-ignored |
| `Dockerfile.api` | Keep as-is |
| `Dockerfile.web` | Keep as-is |
| `Dockerfile.admin` | Keep as-is |

### What stays the same
- Nginx config (`nginx/moxic.conf`)
- All Dockerfiles
- All .NET / React source code
- Appsettings files (API reads from env override at runtime)

## Security

- `.env` never committed to git (add `.env` to `.gitignore`)
- Docker Hub credentials: set `$env:DOCKER_PASSWORD` as secret on server, pipe to `docker login`
- SMTP password in `.env` (same as now)
- MinIO access keys in `.env` (same as now)
- Postgres port: `127.0.0.1:5432` or no external bind
- MinIO ports: `127.0.0.1:9000:9000` to prevent direct external access

## Rollback

If new images fail:
```bash
docker compose pull moxic-api:previous-tag
docker compose up -d
```
Or keep previous images tagged `:prev` before pulling `:latest`.

# Deployment Guide File

Final deliverable: `docs/deployment-guide.md` — one self-contained guide with:
1. Prerequisites
2. Initial server setup (step-by-step)
3. Build & deploy CI (Windows PowerShell)
4. Daily operations (logs, restart, rollback)
5. Troubleshooting
6. Appendix: env reference
