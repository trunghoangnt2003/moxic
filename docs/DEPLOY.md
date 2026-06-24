# H??ng D?n Deploy Moxic GameStore

## 1. Chu?n B?

### 1.1. Domain + DNS (Cloudflare)
1. ??ng k? Cloudflare, th?m domain `moxic.co`
2. Cloudflare qu?t DNS records, ??i nameserver t?i registrar
3. T?o DNS records:

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | @ | 34.158.54.48 | Proxied (cam) |
| CNAME | www | moxic.co | Proxied (cam) |
| CNAME | api | moxic.co | Proxied (cam) |
| CNAME | admin | moxic.co | Proxied (cam) |
| CNAME | minio | moxic.co | Proxied (cam) |

### 1.2. Docker Hub
1. ??ng k? Docker Hub: https://hub.docker.com
2. T?o repository: `moxic-api`, `moxic-web`, `moxic-admin`
3. T?o Access Token (Settings ? Security ? New Access Token)

### 1.3. GCP Server (Debian/Ubuntu)
```bash
ssh root@34.158.54.48

# C?i Docker
curl -fsSL https://get.docker.com | sh

# C?i Docker Compose plugin
apt update && apt install -y docker-compose-plugin

# T?o project dir
mkdir -p /opt/moxic
```

### 1.4. SSL Certificate (Let"s Encrypt)
```bash
ssh root@34.158.54.48

# C?i certbot
apt install -y certbot

# L?y cert
certbot certonly --standalone -d moxic.co -d www.moxic.co -d api.moxic.co -d admin.moxic.co --non-interactive --agree-tos -m trungnt260303@gmail.com

# Copy cert v?o Docker volume
docker run --rm -v moxic_nginx_certs:/certs -v /etc/letsencrypt:/letsencrypt alpine sh -c "cp /letsencrypt/live/moxic.co/fullchain.pem /certs/ && cp /letsencrypt/live/moxic.co/privkey.pem /certs/"

# Auto-renew (cron)
echo "0 3 * * * certbot renew --quiet && docker run --rm -v moxic_nginx_certs:/certs -v /etc/letsencrypt:/letsencrypt alpine sh -c 'cp /letsencrypt/live/moxic.co/fullchain.pem /certs/ && cp /letsencrypt/live/moxic.co/privkey.pem /certs/' && docker exec moxic-nginx nginx -s reload" | crontab -
```

---

## 2. Build & Push Image (t? m?y local)

```bash
# ?i?n Docker Hub username
nano .env.production

# Build & push
chmod +x scripts/build-and-push.sh
./scripts/build-and-push.sh <docker-username>
```

---

## 3. Deploy l?n Server

### Option A: D?ng script
```bash
export DOCKER_USERNAME=<username>
export DOCKER_PASSWORD=<token>
./scripts/deploy.sh root
```

### Option B: Th? c?ng t?ng b??c

```bash
# Copy files l?n server
scp docker-compose.prod.yml root@34.158.54.48:/opt/moxic/docker-compose.yml
scp .env.production root@34.158.54.48:/opt/moxic/.env
scp nginx/moxic.conf root@34.158.54.48:/opt/moxic/nginx/moxic.conf

# SSH v?o server
ssh root@34.158.54.48
cd /opt/moxic

# Login Docker Hub
export DOCKER_USERNAME=<username>
export DOCKER_PASSWORD=<token>
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

# C?p nh?t images
docker compose pull

# N?u build t?i server (kh?ng c?n Docker Hub):
# docker compose build

# Ch?y
docker compose up -d

# Ki?m tra
docker compose ps
docker compose logs -f
```

---

## 4. Ki?m Tra

| URL | N?i dung |
|-----|----------|
| https://moxic.co | Storefront |
| https://admin.moxic.co | Admin Panel |
| https://api.moxic.co/swagger | API Swagger |

---

## 5. C?p Nh?t Khi C? Code M?i

```bash
# Local
./scripts/build-and-push.sh <username>

# Server
ssh root@34.158.54.48
cd /opt/moxic
docker compose pull
docker compose up -d --force-recreate
```

---

## 6. L?nh Th??ng D?ng

```bash
# Xem logs
docker compose logs -f moxic-api
docker compose logs -f moxic-web

# Restart service
docker compose restart moxic-api

# D?ng
docker compose down

# Backup DB
docker exec moxic-postgres pg_dump -U moxic moxic > backup.sql
```
