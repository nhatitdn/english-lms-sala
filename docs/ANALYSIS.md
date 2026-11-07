# BƯỚC 1 — PHÂN TÍCH YÊU CẦU

> Trạng thái: **Đã có quyết định từ chủ dự án (07/11/2026)** — xem mục 7

## 1. Tóm tắt bài toán

Một website gồm 2 phần trong **cùng một ứng dụng Next.js**:

| Phần | Người dùng | Mục tiêu |
|---|---|---|
| Website công khai | Khách, phụ huynh tìm lớp | Giới thiệu, SEO, thu lead (đăng ký học thử / tư vấn) |
| LMS (cổng nội bộ) | Admin, Giáo viên, Học viên, Phụ huynh | Quản lý lớp, bài giảng, audio, bài tập, chấm điểm, điểm danh, lịch, thông báo |

Quy mô nhỏ (≤5 lớp, <100 học viên, 1–3 GV) → **một VPS, một instance ứng dụng, một PostgreSQL** là đủ. Kiến trúc phải giữ được khả năng mở rộng lên trung tâm (vài trăm – vài nghìn học viên) mà không phải viết lại.

## 2. Phân tích theo nhóm chức năng

| # | Module | Độ phức tạp | Rủi ro chính |
|---|---|---|---|
| 1 | Auth + RBAC (4 vai trò) | Trung bình | Lỗ hổng phân quyền ở backend; trẻ em không có email |
| 2 | Quản lý lớp, học viên, chuyển lớp | Trung bình | Giữ lịch sử khi chuyển lớp |
| 3 | Bài giảng + thư viện tài liệu | Trung bình | XSS trong rich text; tái sử dụng tài liệu |
| 4 | Audio player | Trung bình | **Tua (seek) trên iOS Safari cần HTTP Range**; ghi nhớ vị trí |
| 5 | Bài tập (10 dạng câu hỏi) | **Cao** | Mô hình dữ liệu linh hoạt; lộ đáp án; mất kết nối khi làm bài |
| 6 | Chấm tự động + thủ công | Cao | Lịch sử chấm; tính điểm từng phần |
| 7 | Ghi âm Speaking | Trung bình | iOS ghi ra `audio/mp4`, Android/Chrome ra `audio/webm` |
| 8 | Điểm danh, lịch học | Thấp–TB | Buổi học định kỳ vs. buổi thực tế (nghỉ, học bù) |
| 9 | Thông báo nội bộ | Thấp | Thông báo "sắp đến hạn" cần tác vụ định kỳ |
| 10 | Dashboard 4 vai trò + báo cáo | Trung bình | Truy vấn tổng hợp |
| 11 | Website công khai + SEO + CMS blog | Trung bình | Không lộ dữ liệu học viên |
| 12 | File, bảo mật, backup, deploy | Trung bình | File nằm ngoài web root, backup/restore chạy thật |

## 3. Các điểm còn thiếu / chưa rõ trong yêu cầu và cách mình đề xuất xử lý

Đây là những chỗ đặc tả chưa nói, mình đã tự chọn phương án đơn giản nhất. **Bạn xem và duyệt.**

1. **Đăng nhập cho trẻ em không có email** → Đăng nhập bằng **tên đăng nhập (username)** hoặc email. Admin tạo tài khoản, đặt mật khẩu tạm, bắt đổi mật khẩu lần đầu. Không có tự đăng ký tài khoản; form công khai chỉ tạo *lead* đăng ký học thử.
2. **"Quên mật khẩu"** → MVP: Admin đặt lại mật khẩu (chưa có email). Có thể thêm reset qua email sau.
3. **Khóa học (Course) và Lớp (Class)** là 2 thực thể khác nhau: *Khóa học* là sản phẩm hiển thị công khai (VD: "Tiếng Anh thiếu nhi Starter"); *Lớp* là một đợt mở cụ thể của khóa học (mã lớp, lịch, học viên). Một lớp có thể không gắn khóa học.
4. **Lớp có thể có nhiều giáo viên** (GV chính + trợ giảng) → bảng `class_teachers` (đặc tả chỉ ghi "Giáo viên").
5. **"Giao cho một nhóm"** cần khái niệm nhóm → thêm `class_groups`, `class_group_members`.
6. **Lịch học**: tách *lịch định kỳ* (`class_schedules`: thứ 3, 5 lúc 18:00–19:30) và *buổi học thực tế* (`class_sessions`: sinh tự động từ lịch định kỳ; có thể hủy, dời, học bù). Điểm danh gắn với **buổi học thực tế**.
7. **Bài Listening** = bài giảng loại Listening có `audio_lessons`; phần câu hỏi dùng chung engine bài tập (một *assignment* gắn với audio). Không xây hai hệ thống câu hỏi.
8. **Bảng `files` dùng chung** để lưu metadata mọi file (ảnh, PDF, audio, video, bản ghi âm). Các bảng khác tham chiếu `file_id`. File vật lý nằm trên đĩa VPS.
9. **Hạn nộp theo đối tượng giao**: một bài tập có thể giao cho nhiều lớp/nhóm/học viên với ngày giao & hạn khác nhau → ngày nằm ở `assignment_targets`; gia hạn riêng từng học viên ở `assignment_extensions`.
10. **Nhận xét giáo viên cho phụ huynh xem** không chỉ gắn với bài nộp → bảng `feedback` cho phép gắn bài nộp *hoặc* chỉ gắn học viên + lớp (nhận xét định kỳ).
11. **Website công khai** cần thêm bảng CMS: `courses`, `posts`, `testimonials`, `gallery_images`, `inquiries` (đăng ký học thử + liên hệ).
12. **Ảnh hoạt động lớp học** có trẻ em → bắt buộc trường *đã có đồng ý của phụ huynh* trước khi xuất bản; tự động xóa EXIF/GPS khi upload ảnh.
13. **Đánh giá học viên/phụ huynh** trên trang chủ do Admin nhập tay, chỉ hiện tên rút gọn (VD: "Chị H., phụ huynh bé lớp Starter") — không liên kết tài khoản thật.
14. **Học phí, thanh toán, hóa đơn**: ứng dụng dùng miễn phí cho lớp của gia đình → **không có module học phí**. Trường `fee_vnd` của khóa học chỉ để hiển thị nếu muốn, có thể để trống.
15. **Video 100 MB**: lưu trên VPS, phát trực tiếp, không chuyển mã (transcode) ở MVP; chỉ nhận MP4 (H.264) / WebM. Video dài khuyến nghị dùng link YouTube (không công khai).

## 4. Yêu cầu phi chức năng

| Hạng mục | Mục tiêu |
|---|---|
| Hiệu năng | Trang công khai LCP < 2,5 s trên 4G; trang LMS phản hồi < 500 ms với dữ liệu quy mô MVP |
| Di động | Mobile-first; làm bài, nghe audio, ghi âm thoải mái trên điện thoại 360 px |
| Bảo mật | OWASP Top 10; kiểm tra quyền ở server cho **mọi** truy vấn và thao tác |
| Riêng tư trẻ em | Thu thập tối thiểu; không công khai thông tin học viên; xóa EXIF; nhật ký truy cập dữ liệu nhạy cảm |
| Độ tin cậy | Backup hằng ngày, giữ ≥7 bản; restore được kiểm thử thật |
| Bảo trì | TypeScript strict; module theo nghiệp vụ; migration có version |
| Chi phí | 1 VPS (~2 vCPU / 4 GB RAM / 80 GB SSD); không dịch vụ trả phí bắt buộc |

## 5. Giả định

- Hosting giai đoạn đầu: **máy ảo Ubuntu 24.04 trên Proxmox tại nhà**, công khai qua Cloudflare Tunnel; sau này chuyển sang VPS bằng backup/restore (xem DEPLOYMENT.md).
- Một tài khoản = một vai trò. Admin có thể kiêm giảng dạy (có hồ sơ giáo viên).
- Giờ lưu trong DB dạng UTC (`timestamptz`), hiển thị theo `Asia/Ho_Chi_Minh`.
- Tiền tệ lưu số nguyên VND (`BigInt`/`Int`), không dùng số thực.
- Chưa có email/Zalo ở MVP; kiến trúc thông báo chừa sẵn "kênh gửi" để thêm sau.

## 6. Quyết định đã chốt (07/11/2026)

| Câu hỏi | Quyết định |
|---|---|
| Thương hiệu | **Sala English Corner** — logo chữ thảo "Sala" màu cam + hoa trắng ngà; bộ nhận diện ở `brand/` và Design System "Sala English Corner" |
| Học phí / thanh toán | Không làm — ứng dụng dùng miễn phí cho lớp |
| Quên mật khẩu | Admin đặt lại mật khẩu; học viên phải đổi lại ở lần đăng nhập kế tiếp |
| Hosting | Tạm thời trên Proxmox tại nhà (VM Ubuntu + Docker Compose + Cloudflare Tunnel) |

## 7. Còn chờ
- Domain chính thức (cần để cấu hình Cloudflare Tunnel, SEO, Open Graph). Phase 1–4 chạy được trên mạng LAN/Tailscale mà chưa cần domain.
