# DEPLOYMENT — Hướng dẫn triển khai & vận hành

> Trạng thái: **Bản khung (draft)**. Giai đoạn đầu chạy trên **Proxmox tại nhà** (mục 0); các mục 1–9 áp dụng khi chuyển lên VPS. Lệnh chi tiết, file cấu hình và script sẽ được viết và **chạy thử thật** ở Phase 5. Các bước dưới đây là thiết kế đã chốt.

## 0. Giai đoạn đầu: Proxmox tại nhà

### Máy ảo
- Tạo **VM Ubuntu Server 24.04** (không dùng LXC — Docker trong LXC unprivileged hay gặp lỗi quyền/overlay): 2 vCPU · 4 GB RAM · ổ 60 GB cho hệ thống + **ổ thứ hai 100 GB+** mount vào `/srv/english-lms` (uploads + backups), để sau này dễ nới dung lượng.
- IP tĩnh trong LAN Proxmox (đặt DHCP reservation trên MikroTik hoặc cấu hình netplan).
- Bật QEMU guest agent; bật "Start at boot" để VM tự chạy lại sau khi mất điện.
- Bên trong VM cài Docker và chạy y hệt môi trường VPS (cùng `docker-compose.yml`) → khi chuyển lên VPS chỉ cần backup/restore.

### Đưa website ra Internet — Cloudflare Tunnel (miễn phí)
Mạng nhà có modem VNPT và MikroTik phía sau (NAT 2 lớp), IP nhà có thể đổi. Vì vậy **không mở port**, dùng Cloudflare Tunnel:
- Thêm container `cloudflared` vào compose; tunnel kết nối **ra ngoài** tới Cloudflare, không cần port forwarding, không lộ IP nhà.
- Cần domain đặt DNS tại Cloudflare (gói Free). TLS do Cloudflare cấp, nên **bỏ Certbot** ở giai đoạn này; Nginx chỉ nghe nội bộ HTTP.
- Nginx giữ nguyên vai trò: X-Accel cho file, header bảo mật, giới hạn upload.
- Lấy IP thật của người dùng (cho rate limit) từ header `CF-Connecting-IP` — chỉ tin header này khi request đến từ cloudflared.
- **Lưu ý giới hạn:** gói Free của Cloudflare chặn request upload > **100 MB** → giới hạn video mặc định đặt **90 MB** khi chạy qua Tunnel (sửa được trong Cài đặt hệ thống). Video dài nên dùng YouTube.
- Cấu hình Cloudflare **không cache** `/api/*` và `/app/*` (file riêng tư đã có `Cache-Control: private`, thêm Cache Rule bypass cho chắc).

### Truy cập quản trị
- SSH vào VM, xem log, chạy restore: chỉ qua **Tailscale**, không mở SSH ra Internet.
- Trong lúc chưa có domain (Phase 1–4), giáo viên/học viên thử nghiệm có thể vào qua IP LAN hoặc Tailscale.

### Backup 2 lớp
1. **Trong ứng dụng**: `scripts/backup.sh` (pg_dump + uploads, giữ 7 bản) như mục 6.
2. **Proxmox**: lịch `vzdump` snapshot cả VM hằng đêm vào một ổ/datastore khác (giữ 3–7 bản) để khôi phục nhanh cả máy.
3. Khuyến nghị thêm 1 bản ra ngoài nhà (rclone → Google Drive/OneDrive) phòng hỏng ổ cứng hoặc mất máy.

### Hạn chế cần chấp nhận
- Mất điện/mất mạng ở nhà → website ngừng; nên có UPS cho máy Proxmox + router.
- Tốc độ upload lên Internet của đường mạng nhà quyết định tốc độ phát audio/video cho học viên.
- Khi lớp đông hơn hoặc cần ổn định hơn: chuyển sang VPS theo mục 1–9 (restore bản backup mới nhất, trỏ lại tunnel/DNS).

## 1. Yêu cầu VPS
- Ubuntu 24.04 LTS · 2 vCPU · 4 GB RAM · ≥ 80 GB SSD (video/audio chiếm nhiều nhất).
- Domain trỏ về IP VPS (bản ghi `A` cho `@` và `www`).

## 2. Cài đặt VPS lần đầu
1. Tạo user thường có sudo, tắt đăng nhập root và đăng nhập bằng mật khẩu qua SSH (chỉ dùng SSH key).
2. Firewall `ufw`: chỉ mở 22, 80, 443. Cài `fail2ban` cho SSH.
3. Bật cập nhật bảo mật tự động (`unattended-upgrades`).
4. Cài Docker Engine + Docker Compose plugin.
5. Tạo thư mục: `/opt/english-lms` (mã nguồn), `/srv/english-lms/uploads`, `/srv/english-lms/backups`.

## 3. Cấu hình
- Clone repo vào `/opt/english-lms`, tạo `.env` từ `.env.example` (quyền `600`). **Không commit `.env`**.
- Biến chính: `DATABASE_URL`, `POSTGRES_PASSWORD`, `AUTH_SECRET`, `APP_URL`, `CRON_SECRET`, `UPLOAD_DIR`, `TZ=Asia/Ho_Chi_Minh`.
- Sinh bí mật: `openssl rand -base64 32`.

## 4. SSL
- Certbot (Let's Encrypt, miễn phí) chế độ webroot qua container Nginx.
- Cron gia hạn 2 lần/ngày + `nginx -s reload`.

## 5. Deploy & Update — `scripts/deploy.sh`
1. Backup DB ngay trước khi cập nhật.
2. `git pull` phiên bản/tag cần triển khai.
3. `docker compose build app`.
4. `docker compose run --rm app npx prisma migrate deploy` (không bao giờ `migrate reset`/`db push`).
5. `docker compose up -d` → chờ `/api/health` trả OK; nếu lỗi → hướng dẫn quay lại bản trước (mục 8).

Lần đầu: thêm `npm run create-admin` để tạo tài khoản Admin.

## 6. Backup — `scripts/backup.sh` (cron host, 02:30 hằng ngày)
- `pg_dump -Fc` (định dạng nén, restore chọn lọc được).
- `tar` thư mục uploads (tài liệu, audio, hình ảnh, bản ghi âm).
- Tên file có ngày giờ; **giữ 7 bản gần nhất** (+ tùy chọn 4 bản theo tuần).
- Kiểm tra file backup khác rỗng, ghi log, báo lỗi lên dashboard Admin nếu backup thất bại.
- Khuyến nghị: đồng bộ thêm ra ngoài VPS bằng `rclone` (Google Drive/OneDrive, miễn phí).

## 7. Restore — `scripts/restore.sh <ngày>`
1. Dừng app (giữ Postgres chạy).
2. Backup trạng thái hiện tại (phòng trường hợp restore nhầm).
3. `pg_restore --clean --if-exists` vào DB.
4. Giải nén uploads về đúng thư mục.
5. Khởi động app, kiểm tra `/api/health` và đăng nhập thử.
Diễn tập restore trên VPS là điều kiện nghiệm thu #12.

## 8. Kiểm tra log & khôi phục khi lỗi
- `docker compose ps` · `docker compose logs -f app` · `docker compose logs nginx`.
- Log ứng dụng dạng JSON một dòng, xoay vòng bằng cấu hình logging của Docker (`max-size`, `max-file`).
- App không lên → xem log → quay lại image trước (`docker compose up -d` với tag cũ). Migration lỗi → restore bản backup tạo ở bước 1 của deploy.
- Đầy ổ đĩa → `docker system prune`, kiểm tra thư mục backup, dọn file mồ côi.

## 9. Health check
- `GET /api/health` kiểm tra kết nối DB và quyền ghi thư mục upload.
- Docker `healthcheck` cho app và postgres; Nginx chỉ chuyển request khi app healthy.
- Tùy chọn: UptimeRobot (gói miễn phí) gọi `/api/health` mỗi 5 phút.
