Hướng Dẫn Deploy Moxic GameStore1. Chuẩn Bị1.1. Domain + DNS (Cloudflare)Đăng ký tài khoản Cloudflare, thêm tên miền moxic.co vào quản lý.Cho Cloudflare quét các bản ghi DNS cũ, sau đó đổi Nameservers tại nhà đăng ký tên miền (Registrar) sang Nameservers của Cloudflare.Tạo các bản ghi DNS mới theo bảng sau:Type (Loại)Name (Tên bản ghi)Value (Giá trị / IP)Proxy (Đám mây)A@ (hoặc moxic.co)34.158.54.48Proxied (Màu cam)CNAMEwwwmoxic.coProxied (Màu cam)CNAMEapimoxic.coProxied (Màu cam)CNAMEadminmoxic.coProxied (Màu cam)CNAMEminiomoxic.coProxied (Màu cam)1.2. Docker HubĐăng ký tài khoản Docker Hub tại: https://hub.docker.comTạo 3 repositories mới với tên: moxic-api, moxic-web, moxic-admin.Tạo một Access Token bảo mật bằng cách vào: Settings $\rightarrow$ Security $\rightarrow$ New Access Token.1.3. Cấu hình GCP Server (Hệ điều hành Debian/Ubuntu)Truy cập vào server thông qua SSH và chạy các lệnh sau:Bash# SSH vào server GCP
ssh root@34.158.54.48

# Cài đặt Docker engine bản mới nhất
curl -fsSL https://get.docker.com | sh

# Cài đặt plugin Docker Compose
apt update && apt install -y docker-compose-plugin

# Tạo thư mục lưu trữ dự án
mkdir -p /opt/moxic
1.4. Cấu hình SSL Certificate (Let's Encrypt)Chạy các lệnh dưới đây trực tiếp trên Server để khởi tạo và tự động gia hạn SSL:Bash# Kết nối SSH vào server
ssh root@34.158.54.48

# Cài đặt Certbot công cụ lấy SSL miễn phí
apt install -y certbot

# Yêu cầu cấp chứng chỉ SSL cho tất cả các subdomain cùng lúc
certbot certonly --standalone -d moxic.co -d www.moxic.co -d api.moxic.co -d admin.moxic.co --non-interactive --agree-tos -m trungnt260303@gmail.com

# Sao chép chứng chỉ SSL vừa khởi tạo vào Docker volume để Nginx có thể đọc được
docker run --rm -v moxic_nginx_certs:/certs -v /etc/letsencrypt:/letsencrypt alpine sh -c "cp /letsencrypt/live/moxic.co/fullchain.pem /certs/ && cp /letsencrypt/live/moxic.co/privkey.pem /certs/"

# Cấu hình tính năng Tự động gia hạn SSL (sử dụng cronjob chạy vào 3 giờ sáng mỗi ngày)
echo "0 3 * * * certbot renew --quiet && docker run --rm -v moxic_nginx_certs:/certs -v /etc/letsencrypt:/letsencrypt alpine sh -c 'cp /letsencrypt/live/moxic.co/fullchain.pem /certs/ && cp /letsencrypt/live/moxic.co/privkey.pem /certs/' && docker exec moxic-nginx nginx -s reload" | crontab -
2. Build & Push Image (Chạy từ máy Local của Developer)Mở terminal tại máy cá nhân của bạn, cấu hình môi trường và kích hoạt script đóng gói:Bash# Điền thông tin Docker Hub username và các biến môi trường khác
nano .env.production

# Cấp quyền thực thi và chạy script để build + đẩy mã nguồn lên Docker Hub
chmod +x scripts/build-and-push.sh
./scripts/build-and-push.sh <docker-username>
3. Deploy Lên ServerLựa chọn A: Triển khai nhanh bằng Script tự độngBashexport DOCKER_USERNAME=<username-docker-cua-ban>
export DOCKER_PASSWORD=<token-docker-vua-tao>
./scripts/deploy.sh root
Lựa chọn B: Triển khai thủ công từng bướcBash# 1. Copy các file cấu hình cần thiết từ máy local lên server qua SCP
scp docker-compose.prod.yml root@34.158.54.48:/opt/moxic/docker-compose.yml
scp .env.production root@34.158.54.48:/opt/moxic/.env
scp nginx/moxic.conf root@34.158.54.48:/opt/moxic/nginx/moxic.conf

# 2. SSH trực tiếp vào server
ssh root@34.158.54.48
cd /opt/moxic

# 3. Đăng nhập vào Docker Hub ngay trên server bằng Token
export DOCKER_USERNAME=<username-docker-cua-ban>
export DOCKER_PASSWORD=<token-docker-vua-tao>
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

# 4. Tải các bản cập nhật Image mới nhất về server
docker compose pull

# (Mẹo phụ) Nếu bạn muốn tự Build code ngay tại server mà không cần thông qua Docker Hub:
# docker compose build

# 5. Khởi chạy toàn bộ hệ thống ở chế độ chạy ngầm (Background/Detached)
docker compose up -d

# 6. Kiểm tra lại tình trạng hoạt động và logs hệ thống
docker compose ps
docker compose logs -f
4. Kiểm Tra Sau Triển KhaiSau khi hệ thống khởi chạy thành công, truy cập các đường dẫn sau để kiểm tra tính năng:URL hệ thốngNội dung hiển thịhttps://moxic.coGiao diện cửa hàng (Storefront) dành cho khách hànghttps://admin.moxic.coBảng điều khiển quản trị (Admin Panel)https://api.moxic.co/swaggerTài liệu hệ thống API (Swagger UI)5. Quy Trình Cập Nhật Khi Có Code Mới (CI/CD Thủ Công)Mỗi khi bạn sửa đổi mã nguồn và muốn cập nhật lên server, hãy thực hiện quy trình sau:Bash# BƯỚC 1: Thực hiện tại máy cá nhân (Local) để đóng gói và push code mới
./scripts/build-and-push.sh <username-docker>

# BƯỚC 2: Truy cập vào Server và ra lệnh cập nhật lại container
ssh root@34.158.54.48
cd /opt/moxic
docker compose pull
docker compose up -d --force-recreate
6. Các Lệnh Quản Trị Thường Dùng (Cheat Sheet)Dưới đây là các lệnh hữu ích giúp bạn vận hành hệ thống ổn định hằng ngày:Bash# Xem logs thời gian thực (real-time) của các service cốt lõi
docker compose logs -f moxic-api
docker compose logs -f moxic-web

# Khởi động lại riêng lẻ một dịch vụ (ví dụ: khi cập nhật cấu hình API)
docker compose restart moxic-api

# Dừng toàn bộ hệ thống (Hạ server)
docker compose down

# Sao lưu dữ liệu (Backup) từ cơ sở dữ liệu PostgreSQL ra file sql bảo mật
docker exec moxic-postgres pg_dump -U moxic moxic > backup.sql