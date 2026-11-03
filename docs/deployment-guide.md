# Hướng Dẫn Deploy Moxic GameStore

> Build trên Windows → Push Docker Hub → Pull và chạy trên Linux server.
> Mọi service chạy trong Docker network nội bộ. Nginx là cổng vào duy nhất cho tất cả domain.

---

## Kiến Trúc

```
User → DNS (Cloudflare)
         ↓
    Server (34.158.54.48) :80/:443
         ↓
      Nginx (reverse proxy)
      /    |     \       \
moxic-web moxic-admin moxic-api minio
     |         |         |       |
   :3001      :3002     :8080   :9000
            postgres:5432
```

**Domains:**
| Domain | Chạy service nào |
|--------|-----------------|
| `moxic.co` + `www.moxic.co` | Moxic.Web (store frontend) |
| `admin.moxic.co` | Moxic.Admin (admin panel) |
| `api.moxic.co` | Moxic.Api (.NET API) |
| `minio.moxic.co` | MinIO (presigned URLs cho game images) |

---

## I. Chuẩn Bị

### Trên máy Windows (máy phát triển)

- Docker Desktop
- Git
- PowerShell 7+
- Quyền push Docker Hub (`trungdocker123`)

### Trên Linux server (34.158.54.48)

- Ubuntu 22.04+
- Docker + Docker Compose plugin
- SSH root access

---

## II. Cấu Trúc Thư Mục Trên Server

```
/opt/moxic/
├── .env                  # Biến môi trường (secrets)
├── docker-compose.yml    # Docker Compose production
├── nginx/
│   └── moxic.conf        # Nginx config
└── certs/                # SSL certificates
    ├── fullchain.pem
    └── privkey.pem
```

---

## III. Thiết Lập Server Lần Đầu (One-time)

### Bước 1: SSH vào server

```bash
ssh root@34.158.54.48
```

### Bước 2: Cài Docker

```bash
apt update && apt install -y docker.io docker-compose-v2
systemctl enable --now docker
```

### Bước 3: Tạo thư mục

```bash
mkdir -p /opt/moxic/nginx /opt/moxic/certs
cd /opt/moxic
```

### Bước 4: Copy file từ máy Windows lên server

Trên **Windows**, chạy các lệnh `scp` này:

```powershell
scp .env.production root@34.158.54.48:/opt/moxic/.env
scp docker-compose.prod.yml root@34.158.54.48:/opt/moxic/docker-compose.yml
scp nginx/moxic.conf root@34.158.54.48:/opt/moxic/nginx/moxic.conf
```

> **Lưu ý:** File `.env.production` cần được rename thành `.env` trên server.

### Bước 5: Cấu hình SSL

**Option A — Cloudflare Full (Strict, khuyến nghị):**
- DNS các domain đặt **Proxied** (đã bật)
- Cloudflare tự động cấp cert, không cần cert file trên server
- Sửa `nginx/moxic.conf`: bỏ dòng `ssl_certificate` và thay bằng cấu hình Cloudflare Origin Certificate nếu muốn
- Hoặc dùng Cloudflare Origin CA để Nginx tự serve SSL

**Option B — Let's Encrypt:**

```bash
apt install -y certbot
certbot certonly --standalone -d moxic.co -d www.moxic.co -d admin.moxic.co -d api.moxic.co -d minio.moxic.co

# Tạo symbolic link để Nginx đọc được
ln -s /etc/letsencrypt/live/moxic.co/fullchain.pem /opt/moxic/certs/fullchain.pem
ln -s /etc/letsencrypt/live/moxic.co/privkey.pem /opt/moxic/certs/privkey.pem

# Auto-renew
echo "0 3 * * * certbot renew --quiet && docker exec moxic-nginx nginx -s reload" | crontab -
```

### Bước 6: Pull images và chạy

```bash
cd /opt/moxic

# Login Docker Hub
echo "$DOCKER_PASSWORD" | docker login -u "trungdocker123" --password-stdin

# Pull images
docker compose pull

# Start toàn bộ
docker compose up -d

# Kiểm tra
docker compose ps
```

---

## IV. Build & Deploy Hàng Ngày

### Trên máy Windows

**Script: `scripts/deploy.ps1`**

```powershell
cd C:\Users\trung\OneDrive\Documents\project-moxic
.\scripts\deploy.ps1 -DockerUser trungdocker123
```

Script này sẽ:
1. Build 3 images
2. Push lên Docker Hub tag `:latest`
3. In ra lệnh SSH để chạy trên server

### Trên Linux server

SSH vào và chạy:

```bash
cd /opt/moxic
docker compose pull
docker compose up -d --force-recreate
docker image prune -f
```

---

## V. Lệnh Thường Dùng

### Xem logs

```bash
# Tất cả services
docker compose logs -f

# Riêng từng service
docker compose logs -f moxic-api
docker compose logs -f moxic-web
docker compose logs -f moxic-admin
docker compose logs -f nginx
```

### Restart service

```bash
docker compose restart moxic-api
```

### Kiểm tra trạng thái

```bash
docker compose ps
curl -I https://api.moxic.co/api/games
```

### Truy cập database

```bash
docker exec -it moxic-postgres psql -U moxic -d moxic
```

### Backup database

```bash
docker exec -t moxic-postgres pg_dump -U moxic moxic > backup-$(date +%Y%m%d).sql
```

---

## VI. Rollback

Nếu bản mới bị lỗi, deploy lại bản cũ:

```bash
# Cách 1: Pull lại tag cũ
docker pull trungdocker123/moxic-api:20260601
docker tag trungdocker123/moxic-api:20260601 trungdocker123/moxic-api:latest
docker compose up -d

# Cách 2: Dùng image cũ trong cache
# Kiểm tra image ID cũ
docker images trungdocker123/moxic-api
docker tag <old-image-id> trungdocker123/moxic-api:latest
docker compose up -d
```

---

## VII. Cấu Hình Biến Môi Trường

File `.env` trên server được đọc bởi `docker-compose.yml`.

```ini
# Database
DB_NAME=moxic
DB_USER=moxic
DB_PASSWORD=moxic123

# MinIO
MINIO_USER=moxicadmin
MINIO_PASSWORD=moxic123456
MINIO_GAMES_BUCKET=moxic-games
MINIO_CONFIG_BUCKET=moxic-config

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=moxmoz29@gmail.com
SMTP_PASSWORD=lecn pmyk zome stdz
SMTP_ADMIN_EMAIL=moxmoz29@gmail.com

# CORS
CORS_ORIGINS=https://moxic.co,https://admin.moxic.co,https://api.moxic.co
```

> **Lưu ý:** File `.env` không được commit vào git. Đã có `.gitignore` loại trừ `.env`.

---

## VIII. Xử Lý Sự Cố

### API không đọc được env

**.NET config priority:** `appsettings.json` → `appsettings.{Environment}.json` → Environment variables → Command line.

Trong Docker, env var với key phức tạp dùng dấu `__` (double underscore):
- `ConnectionStrings__DefaultConnection`
- `Minio__Endpoint`
- `Minio__AccessKey`

Kiểm tra container có nhận đúng env không:

```bash
docker exec moxic-api env | grep -i minio
docker exec moxic-api env | grep -i connection
```

### CORS errors trên frontend

Đảm bảo `CORS_ORIGINS` trong `.env` chứa đúng domain frontend:

```ini
CORS_ORIGINS=https://moxic.co,https://admin.moxic.co
```

Và kiểm tra Nginx có thêm header `Access-Control-Allow-Origin` không.

### MinIO presigned URL sai domain

Kiểm tra `Minio__PublicEndpoint` trong docker-compose. Giá trị đúng là `minio.moxic.co`.

### Frontend không gọi được API

- Kiểm tra `VITE_API_URL` build arg: phải là `https://api.moxic.co`
- Nếu build lại quên arg, image cũ vẫn dùng URL cũ

```bash
# Kiểm tra URL mà frontend đang dùng
docker exec moxic-web env | grep VITE_API_URL
docker exec moxic-admin env | grep VITE_API_URL
```

---

## IX. CI/CD Workflow Tóm Tắt

```
Windows (dev machine)
   │  git commit → git push
   │  .\scripts\deploy.ps1
   ▼
Docker Hub
   │  trungdocker123/moxic-{api,web,admin}:latest
   ▼
Linux Server
   │  cd /opt/moxic
   │  docker compose pull && docker compose up -d
   ▼
Production
   moxic.co → Nginx → từng service
```
