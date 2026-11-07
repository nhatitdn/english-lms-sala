# BƯỚC 5 — KẾ HOẠCH PHÁT TRIỂN

> Trạng thái: **Bản đề xuất chờ duyệt**
> Quy tắc: mỗi phase **xong + test pass + bạn nghiệm thu** mới sang phase sau; cập nhật README và docs sau mỗi phase.

| Phase | Nội dung | Thời lượng ước tính* |
|---|---|---|
| 0 | Phân tích & thiết kế (tài liệu này) + bộ nhận diện Sala English Corner | ✅ đang chờ duyệt |
| 1 | Foundation | 1,5–2 tuần |
| 2 | Class & Content | 2–2,5 tuần |
| 3 | Assignment & Grading | 2,5–3 tuần |
| 4 | Management | 1,5–2 tuần |
| 5 | Public website & Deployment | 2 tuần |

\* Ước tính theo nhịp làm việc với Claude + bạn kiểm tra hằng ngày; phụ thuộc tốc độ duyệt.

---

## PHASE 1 — FOUNDATION

**Công việc**
0. Đưa logo, favicon, tokens màu/chữ của Sala English Corner vào dự án.
1. Khởi tạo Next.js + TypeScript strict + Tailwind + shadcn/ui + ESLint/Prettier + Vitest + Playwright.
2. `docker-compose.dev.yml` (Postgres), `.env.example`, `src/server/env.ts` validate biến môi trường.
3. Prisma schema **đầy đủ cho cả dự án** (để không phải đổi cấu trúc lớn về sau) + migration đầu tiên + extension `citext`, `unaccent`.
4. Auth.js: đăng nhập username/email, đổi mật khẩu bắt buộc lần đầu, khóa tài khoản sau 5 lần sai, `session_version`.
5. RBAC: `requireRole`, policies theo tài nguyên, wrapper `action()`, ghi `activity_logs`.
6. Design system: tokens, font, các component nền (Button, Input, Select, Modal, Card, Table, Badge, Toast, Skeleton, EmptyState, ErrorState) + trang `/app/admin/design-system` để xem tổng hợp.
7. App shell: sidebar desktop, bottom nav mobile, header thông báo, chuyển hướng theo vai trò.
8. Admin quản lý người dùng (tạo/sửa/khóa/đặt lại mật khẩu/liên kết phụ huynh–học viên).
9. 4 dashboard khung (dữ liệu thật từ DB, hiển thị empty state khi chưa có).
10. `npm run create-admin`, seed base, seed demo tách riêng.

**Kiểm thử**: đăng nhập đúng/sai/khóa; mỗi vai trò không vào được khu vực vai trò khác; mật khẩu lưu dạng hash; đổi mật khẩu thu hồi phiên cũ.
**Nghiệm thu**: tiêu chí #2 (Admin tạo được tài khoản học viên).

## PHASE 2 — CLASS & CONTENT

**Công việc**
1. CRUD lớp, mã lớp, trình độ, độ tuổi, trạng thái; gán giáo viên.
2. Thành viên lớp: thêm/xóa/tìm kiếm, **chuyển lớp giữ lịch sử**, nhóm trong lớp, nhập học viên từ CSV.
3. Lịch định kỳ + sinh buổi học (chưa có giao diện lịch đầy đủ — Phase 4).
4. Upload pipeline: kiểm tra MIME/extension/dung lượng, tên ngẫu nhiên, xóa EXIF, `X-Accel`/stream có Range.
5. Thư viện tài liệu: upload, phân loại kỹ năng, tag chủ đề, tìm kiếm không dấu, tái sử dụng.
6. Bài giảng: Tiptap editor, đính kèm PDF/Word/PPT/MP3/video/YouTube, nháp/xuất bản, chọn lớp, sao chép.
7. **Audio player** hoàn chỉnh + bài Listening (transcript, ảnh, ghi nhớ vị trí, thống kê hoàn thành).
8. Trang lớp: Tổng quan, Thành viên, Bài giảng, Tài liệu, Audio.

**Kiểm thử**: học viên không xem được bài giảng/file của lớp khác (kể cả đoán URL `/api/files/:id`); GV không quản lý lớp không được phân công; file `.exe` đổi đuôi `.mp3` bị từ chối; vượt dung lượng bị từ chối; tua audio trên Safari iOS.
**Nghiệm thu**: #1, #3, #4, #5.

## PHASE 3 — ASSIGNMENT & GRADING

**Công việc**
1. Trình soạn bài tập: 10 dạng câu hỏi (+ Listening Quiz gắn audio), điểm, thời gian, số lần làm, chế độ hiện đáp án.
2. Giao bài: toàn lớp / nhóm / từng học viên, hẹn giờ giao, hạn nộp, gia hạn, cho nộp lại.
3. Màn hình làm bài mobile-first: tự lưu, khôi phục khi tải lại, chế độ offline, đồng hồ server, ghi âm, upload ảnh/file.
4. Chấm tự động (MC, MS, TF, Fill blank, Matching, Ordering) — có test cho từng dạng, kể cả điểm từng phần.
5. Hàng chờ chấm của GV: xem bài, chấm từng câu, nhận xét, đánh dấu cần sửa, cho nộp lại, lịch sử nộp & lịch sử chấm.
6. Bảng điểm lớp; học viên xem điểm & nhận xét.

**Kiểm thử**: nộp sau hạn; nộp quá số lần; tải lại / mất mạng giữa bài; học viên không nhận được đáp án trong JSON; học viên không gọi được action chấm điểm; nộp 2 lần đồng thời chỉ tạo 1 bài nộp.
**Nghiệm thu**: #6, #7, #8, #9.

## PHASE 4 — MANAGEMENT

**Công việc**
1. Điểm danh theo buổi (4 trạng thái, thao tác nhanh trên điện thoại), thống kê chuyên cần.
2. Lịch học: danh sách / tuần / tháng; hủy buổi, dời buổi, học bù.
3. Thông báo nội bộ (6 loại) + chuông thông báo + cron "sắp đến hạn"; thông báo lớp.
4. Cổng phụ huynh: nhiều con, lịch, chuyên cần, bài tập, điểm, nhận xét.
5. Báo cáo + biểu đồ Recharts trên dashboard Admin/GV.

**Kiểm thử**: phụ huynh không xem được học viên không liên kết (kể cả đổi `studentId` trên URL); thông báo không gửi trùng.
**Nghiệm thu**: #10.

## PHASE 5 — PUBLIC WEBSITE & DEPLOYMENT

**Công việc**
1. 10 trang công khai, trang chủ đủ 8 khối, CMS (khóa học, bài viết, ảnh, đánh giá, thông tin liên hệ).
2. Form đăng ký học thử/tư vấn (chống spam) + trang quản lý lead cho Admin.
3. SEO: metadata, Open Graph, sitemap, robots, JSON-LD (`EducationalOrganization`, `Course`, `Article`, `BreadcrumbList`), tối ưu ảnh; Lighthouse ≥ 90 trên mobile.
4. Docker production trên VM Proxmox, Nginx, Cloudflare Tunnel + domain, backup/restore tự động (script + vzdump), health check, `deploy.sh`.
5. Kiểm thử tổng: E2E toàn bộ 13 tiêu chí nghiệm thu, kiểm thử responsive (360/768/1280 px), rà soát phân quyền.
6. Hoàn thiện `DEPLOYMENT.md`, `USER_GUIDE.md`.

**Nghiệm thu**: #11, #12 (diễn tập restore thật trên VM Proxmox), #13.

---

## Tiêu chí nghiệm thu ↔ Phase

| # | Tiêu chí | Phase |
|---|---|---|
| 1 | Admin tạo được lớp | 2 |
| 2 | Admin tạo được tài khoản học viên | 1 |
| 3 | Giáo viên đăng bài giảng được | 2 |
| 4 | Giáo viên upload audio được | 2 |
| 5 | Học viên nghe audio được | 2 |
| 6 | Giáo viên giao bài được | 3 |
| 7 | Học viên làm và nộp bài được | 3 |
| 8 | Giáo viên chấm bài được | 3 |
| 9 | Học viên xem điểm được | 3 |
| 10 | Phụ huynh xem được kết quả của con | 4 |
| 11 | Website hoạt động trên điện thoại | 1→5 (kiểm tra mỗi phase) |
| 12 | Backup và restore hoạt động | 5 |
| 13 | Không có lỗi phân quyền nghiêm trọng | 1→5 (test tự động tích lũy) |

## Rủi ro & cách giảm

| Rủi ro | Giảm thiểu |
|---|---|
| Engine bài tập phức tạp, dễ trễ | Làm 6 dạng tự chấm trước, 4 dạng chấm tay sau, cùng một renderer |
| Ghi âm khác nhau giữa iOS/Android | Thử trên thiết bị thật sớm ở Phase 3; nhận cả `webm` và `mp4` |
| Hết dung lượng VPS do video | Giới hạn 100 MB, cảnh báo dung lượng trên dashboard Admin, khuyến nghị YouTube |
| Backup nằm cùng VPS | Khuyến nghị đồng bộ thêm ra ngoài (Google Drive qua rclone — miễn phí, tùy chọn) |
