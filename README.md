# Sala English Corner — Website & LMS lớp học tiếng Anh

![Sala English Corner](brand/logo-horizontal.png)

Website công khai + hệ thống LMS cho Admin, Giáo viên, Học viên, Phụ huynh. Dùng miễn phí cho lớp học.
Monolith Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · PostgreSQL · Prisma · Auth.js · Docker Compose · Nginx.

## Trạng thái

| Phase | Trạng thái |
|---|---|
| 0 — Phân tích & thiết kế | ✅ Hoàn thành |
| 1 — Foundation | 🟡 Xong, chờ nghiệm thu (nhánh `phase-1-foundation`) |
| 2 — Class & Content | 🟡 Xong, chờ nghiệm thu (nhánh `phase-2-class-content`) |
| 3 — Assignment & Grading | 🟡 Xong, chờ nghiệm thu (nhánh `phase-3-assignments`) |
| 4 — Management | ⚪ |
| 5 — Public website & Deployment | ⚪ |

## Tài liệu

| File | Nội dung |
|---|---|
| [docs/ANALYSIS.md](docs/ANALYSIS.md) | Bước 1 — Phân tích yêu cầu, điểm chưa rõ, câu hỏi cần trả lời |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Bước 2 — Kiến trúc, bảo mật, quản lý file |
| [docs/DATABASE.md](docs/DATABASE.md) | Bước 3 — Thiết kế bảng, ràng buộc, index |
| [docs/ERD.md](docs/ERD.md) | Bước 3 — Sơ đồ quan hệ (Mermaid) |
| [docs/STRUCTURE.md](docs/STRUCTURE.md) | Bước 4 — Cấu trúc thư mục source code |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Bước 5 — Kế hoạch 5 phase & nghiệm thu |
| [docs/UI_UX.md](docs/UI_UX.md) | Bước 6 — Design system, dashboard GV/HV, sitemap |
| [docs/API.md](docs/API.md) | Route Handlers & Server Actions |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Triển khai VPS, SSL, backup/restore (khung) |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Hướng dẫn sử dụng (khung) |
| [brand/](brand/) | Logo, icon, ảnh chia sẻ — xem `brand/README.md` |

## Chạy trên máy dev

Yêu cầu: Node.js 22+, Docker Desktop (hoặc PostgreSQL 16 cài sẵn), Git.

```bash
npm install                                   # cài thư viện + sinh Prisma Client
cp .env.example .env                          # rồi điền AUTH_SECRET (openssl rand -base64 32)
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL 16 (+ DB test, shadow)
npm run db:deploy                             # chạy migration
npm run db:seed                               # cài đặt hệ thống mặc định
npm run create-admin                          # tạo tài khoản quản trị đầu tiên (nhập mật khẩu)
npm run dev                                   # http://localhost:3000
```

Dữ liệu demo (chỉ dùng trên máy dev, script tự từ chối chạy ở production):

```bash
SEED_DEMO=true npm run db:seed:demo           # PowerShell: $env:SEED_DEMO="true"; npm run db:seed:demo
```

Tài khoản demo, mật khẩu `demo1234`: `admin.demo` · `gv.lan` · `gv.minh` · `hv.minhanh` · `hv.quocbao` · `hv.giahan` · `hv.ducthinh` · `hv.thao` (học viên người lớn) · `ph.huong` (phụ huynh của Minh Anh và Quốc Bảo).

## Kiểm tra chất lượng

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript strict
npm test              # Vitest — tích hợp với PostgreSQL thật (DB sala_test, bị xoá mỗi lần chạy)
npm run build && npm run test:e2e   # Playwright — cần DB dev vừa seed demo (một số test dùng lượt làm bài của học viên demo); chạy cả mobile & desktop
```

## Công nghệ

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · Radix UI (shadcn-style) · Prisma 7 + `@prisma/adapter-pg` · PostgreSQL 16 · Auth.js v5 · Argon2id · Zod 4 · Recharts · Vitest · Playwright.

## Phase 3 đã có

- **Soạn bài tập — 10 dạng câu hỏi:** trắc nghiệm 1 đáp án, nhiều đáp án (tính điểm từng phần hoặc đúng hết mới có điểm), Đúng/Sai, điền chỗ trống (`She [[goes]] to school`, nhiều đáp án chấp nhận `[[don't|do not]]`), nối cặp, sắp xếp câu/từ, trả lời ngắn (tự chấm nếu khớp đáp án chấp nhận), viết đoạn văn (đếm từ), nói (ghi âm ngay trên điện thoại), nộp ảnh/file. Mỗi câu có thể kèm ảnh hoặc audio và lời giải thích.
- **Cài đặt bài:** thang điểm (tự quy đổi), giới hạn thời gian, số lần làm, cho/không cho nộp muộn, xáo trộn câu hỏi/lựa chọn, hiện đáp án (ngay sau khi nộp / sau hạn / khi GV cho phép / không hiện). Nhân bản bài; câu hỏi tự khóa khi đã có học viên làm.
- **Giao bài:** cả lớp / một nhóm / từng học viên, hẹn giờ giao, hạn nộp, thời điểm khóa nhận bài, gia hạn riêng từng học viên, miễn nộp. Học viên nhận thông báo trong hệ thống.
- **Luyện nghe có câu hỏi (Listening Quiz):** trong bài giảng → bài nghe → *Tạo câu hỏi nghe*; học viên nghe audio ngay phía trên câu hỏi. Transcript chế độ “sau khi nộp bài nghe” không được gửi xuống trình duyệt trước khi nộp.
- **Màn hình làm bài (mobile-first):** tự lưu ~1,5 giây sau mỗi thay đổi + lưu trên máy (`localStorage`), khôi phục khi tải lại trang, **làm tiếp khi mất mạng** và tự gửi khi có mạng lại, gửi lần cuối khi đóng tab (`keepalive`), đồng hồ theo giờ server, hết giờ tự nộp, cảnh báo khi bài đang mở ở tab/thiết bị khác. Ghi âm: WebM (Android/Chrome) hoặc M4A (iPhone), nghe lại trước khi gửi, hoặc gửi file ghi âm có sẵn.
- **Chấm tự động** ở server cho trắc nghiệm, Đúng/Sai, điền từ, nối cặp, sắp xếp (và trả lời ngắn khớp đáp án). **Đáp án không bao giờ nằm trong dữ liệu gửi cho học viên khi làm bài** (có test).
- **Chấm của giáo viên:** hàng chờ chấm (cũ nhất trước), chấm từng câu (điểm tự động được điền sẵn, sửa được), nhận xét từng câu + nhận xét chung, sửa tổng điểm (bắt buộc ghi lý do), yêu cầu làm lại (học viên được nộp lại, bắt đầu từ bài cũ), lịch sử các lần nộp và **lịch sử chấm** (không ghi đè điểm cũ). Nút “Lưu & chấm bài tiếp theo”.
- **Bảng điểm lớp** (tab *Bảng điểm*): học viên × bài tập, đánh dấu “Thiếu” khi quá hạn chưa nộp, điểm trung bình quy về thang 10, **tải CSV mở bằng Excel**. Học viên xem tab *Điểm của tôi*, trang *Bài tập* (cần làm / đã nộp) và trang kết quả có điểm, nhận xét, đáp án (khi được phép).

## Phase 2 đã có

- **Lớp học:** tạo/sửa/lưu trữ lớp (mã, trình độ, độ tuổi, ngày học, sĩ số, phòng); phân công giáo viên chính/trợ giảng.
- **Thành viên:** tìm & thêm học viên, nhập danh sách từ Excel (tự tạo tài khoản + mật khẩu tạm, tải file CSV kết quả), cho rời lớp, **chuyển lớp giữ nguyên lịch sử**, nhóm trong lớp.
- **Lịch học định kỳ:** hệ thống tự sinh buổi học 8 tuần tới (giờ Việt Nam).
- **Upload an toàn:** kiểm tra đuôi file + nội dung thật (magic bytes), giới hạn dung lượng theo cài đặt, tên file ngẫu nhiên ngoài thư mục web, **ảnh được xóa EXIF/GPS**, tải/phát qua API có kiểm tra quyền, hỗ trợ tua (HTTP Range).
- **Thư viện tài liệu:** PDF, Word, PowerPoint, Excel, MP3, video, ảnh, link YouTube; tìm kiếm không dấu; chia sẻ giữa giáo viên; dùng lại cho nhiều bài giảng.
- **Bài giảng:** soạn nội dung rich text (có chèn ảnh), phân loại 8 kỹ năng, chủ đề, nháp/xuất bản, chọn lớp được xem + hẹn giờ hiển thị, sao chép bài giảng.
- **Luyện nghe:** trình phát audio thân thiện điện thoại (tua ±10 giây, tốc độ 0,5–2×, âm lượng, lặp A–B, điều khiển từ màn hình khóa), nhớ vị trí nghe, transcript (hiện ngay / sau khi nghe xong / ẩn), hình minh họa, thống kê ai đã nghe xong.

## Phase 1 đã có

- Đăng nhập bằng tên đăng nhập hoặc email; mật khẩu Argon2id; khóa 15 phút sau 5 lần sai; giới hạn 20 lần/15 phút mỗi IP.
- Bắt đổi mật khẩu tạm ở lần đăng nhập đầu; đổi mật khẩu / bị khóa / cấp lại mật khẩu → mọi phiên cũ bị thu hồi ngay.
- Phân quyền 4 vai trò kiểm tra ở server (layout + Server Action), policy theo tài nguyên (lớp, học viên, phụ huynh) có test.
- Quản trị người dùng: tạo (mã học viên tự sinh HV0001…), sửa, khóa/mở, ngừng sử dụng, cấp lại mật khẩu tạm, liên kết phụ huynh ↔ học viên, tìm kiếm & lọc.
- Nhật ký hoạt động cho mọi thao tác quản trị và đăng nhập.
- Design system Sala (`/app/admin/design-system`), app shell: sidebar trên máy tính, thanh điều hướng dưới trên điện thoại.
- 4 dashboard lấy dữ liệu thật: Admin, Giáo viên, Học viên, Phụ huynh.
- Database đầy đủ cho cả 5 phase (40 bảng) + migration + ràng buộc riêng (chống trùng thành viên lớp, ảnh chỉ đăng khi phụ huynh đồng ý…).
