# Hướng Dẫn Test Deploy — Moxic GameStore

## Kiến trúc (Test — Không Domain)

Sau khi chạy, server sẽ có:

| Container | Port (host) | Chức năng |
|-----------|-------------|-----------|
| moxic-postgres | 5432 | Database |
| moxic-minio | 9000 / 9001 | Object storage + Console |
| moxic-api | 8080 | Backend API |
| moxic-web | 3001 | Storefront (trang chính) |
| moxic-admin | 3002 | Admin panel |

---

## Bước 1: Chuẩn bị Server

SSH vào server:

```bash
ssh root@34.158.54.48
```

Cài Docker + Docker Compose:

```bash
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
```

Tạo thư mục project:

```bash
mkdir -p /opt/moxic && cd /opt/moxic
```

---

## Bước 2: Tải File Cấu Hình

```bash
cd /opt/moxic

# Tải docker-compose.test.yml từ GitHub
# (Nếu chưa push code lên GitHub thì copy thủ công bằng cách bên dưới)
curl -sL https://raw.githubusercontent.com/trungdocker123/moxic/main/docker-compose.test.yml -o docker-compose.yml
```

> **Nếu chưa có GitHub:** Tạo file `docker-compose.yml` trên server bằng `nano docker-compose.yml` rồi paste nội dung từ file `docker-compose.test.yml` trong project.

Nội dung cần paste (lấy từ local):
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: moxic-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: moxic
      POSTGRES_USER: moxic
      POSTGRES_PASSWORD: moxic123
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio:latest
    container_name: moxic-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: moxicadmin
      MINIO_ROOT_PASSWORD: moxic123456
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  moxic-api:
    image: trungdocker123/moxic-api:test
    container_name: moxic-api
    restart: unless-stopped
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ASPNETCORE_URLS: "http://+:8080"
      ConnectionStrings__DefaultConnection: "Host=postgres;Port=5432;Database=moxic;Username=moxic;Password=moxic123"
      Minio__Endpoint: "34.158.54.48:9000"
      Minio__PublicEndpoint: "34.158.54.48:9000"
      Minio__AccessKey: moxicadmin
      Minio__SecretKey: moxic123456
      Minio__WithSSL: "false"
      Minio__GamesBucket: moxic-games
      Minio__ConfigBucket: moxic-config
      Cors__Origins: "http://34.158.54.48:3001,http://34.158.54.48:3002"
      Smtp__AdminEmail: "trungnt260303@gmail.com"
    depends_on:
      - postgres
    ports:
      - "8080:8080"

  moxic-web:
    image: trungdocker123/moxic-web:test
    container_name: moxic-web
    restart: unless-stopped
    ports:
      - "3001:80"

  moxic-admin:
    image: trungdocker123/moxic-admin:test
    container_name: moxic-admin
    restart: unless-stopped
    ports:
      - "3002:80"

volumes:
  postgres_data:
  minio_data:
```

---

## Bước 3: Login Docker Hub & Pull Images

```bash
docker login -u trungdocker123
# Nhập password hoặc access token

# Pull images
docker compose pull

# (Nếu pull lỗi, chạy từng cái)
docker pull trungdocker123/moxic-api:test
docker pull trungdocker123/moxic-web:test
docker pull trungdocker123/moxic-admin:test
```

---

## Bước 4: Chạy

```bash
docker compose up -d

# Kiểm tra trạng thái
docker compose ps
```

Kết quả mong đợi — tất cả containers ở trạng thái `Up`:

```
NAME                IMAGE                             STATUS   PORTS
moxic-postgres      postgres:16-alpine                Up       127.0.0.1:5432->5432/tcp
moxic-minio         minio/minio:latest                Up       0.0.0.0:9000->9000/tcp, 0.0.0.0:9001->9001/tcp
moxic-api           trungdocker123/moxic-api:test     Up       0.0.0.0:8080->8080/tcp
moxic-web           trungdocker123/moxic-web:test     Up       0.0.0.0:3001->80/tcp
moxic-admin         trungdocker123/moxic-admin:test   Up       0.0.0.0:3002->80/tcp
```

---

## Bước 5: Kiểm Tra

### API
```bash
# Test API
curl http://34.158.54.48:8080/api/games
# Phải trả về JSON danh sách game (mảng, có thể rỗng)

# Swagger UI
# Mở browser: http://34.158.54.48:8080/swagger
```

### Storefront
Mở browser: `http://34.158.54.48:3001`

### Admin Panel
Mở browser: `http://34.158.54.48:3002`
- Username: `admin@moxic.com`
- Password: `Admin@123`

### MinIO Console
Mở browser: `http://34.158.54.48:9001`
- User: `moxicadmin`
- Pass: `moxic123456`

---

## Bước 6: Xem Logs

```bash
# API logs
docker compose logs -f moxic-api

# Tất cả logs
docker compose logs -f

# Web logs
docker compose logs -f moxic-web
```

---

## Lệnh Thường Dùng

```bash
# Dừng tất cả
docker compose down

# Khởi động lại 1 service
docker compose restart moxic-api

# Xóa hết data (cả database)
docker compose down -v

# Cập nhật image mới
docker compose pull
docker compose up -d --force-recreate
```
