# BƯỚC 6 — UI/UX, DESIGN SYSTEM & SITEMAP

> Trạng thái: **Bản đề xuất chờ duyệt**

## 1. Định hướng

"Modern Education Platform": sáng, thoáng, thân thiện nhưng **không trẻ con** (có học viên người lớn). Hình khối bo góc vừa, nhiều khoảng trắng, màu cam/vàng chỉ dùng cho điểm nhấn hành động và thành tích.

## 2. Thương hiệu & design tokens — Sala English Corner

Nguồn chuẩn: Design System "Sala English Corner" (claude.ai) và thư mục `brand/`. Khi code, tokens được chép vào `src/styles/globals.css` dưới dạng CSS variables cho Tailwind/shadcn.

### Logo
- Header website và sidebar LMS: `brand/logo-horizontal.png` (cao 40–48 px). Hero và trang đăng nhập: `logo-stacked.png`. Footer nền tối: các bản `-on-dark`.
- Favicon/PWA: bông hoa trên nền cream (`icon-512.png`, `icon-maskable-512.png`, `favicon.ico`, `apple-touch-icon.png`).

### Màu
Cam là màu thương hiệu (lấy đúng từ logo). Xanh dương nhạt là nền và màu chức năng của LMS, đúng định hướng ban đầu "xanh dương nhạt, trắng, điểm nhấn cam".

| Token | Giá trị | Dùng cho |
|---|---|---|
| `sala-orange` | `#FA7220` | Màu logo, khối trang trí lớn — **không** dùng cho chữ nhỏ (2,8:1) |
| `orange-700` | `#C2410C` | Nút chính (chữ trắng 5,2:1), CTA "Đăng ký học thử", "Làm bài ngay", nhãn sắp hạn |
| `orange-800` | `#9A3A0B` | Hover nút chính |
| `orange-50` | `#FFF1E6` | Nền khối CTA, badge cam |
| `cream` | `#FFF8EE` | Nền ấm website công khai (màu cánh hoa) |
| `petal` / `gold` | `#F3EBCF` / `#C9A646` | Trang trí, sao đánh giá, huy hiệu |
| `gold-700` | `#8A6A12` | Chữ vàng nhấn (4,8:1) |
| `ink` | `#1F2A44` | Chữ chính, footer |
| `ink-muted` | `#526075` | Chữ phụ |
| `sky-50` | `#EEF5FC` | Nền trang LMS, section xen kẽ |
| `sky-100` | `#DCEBFA` | Mục đang chọn ở sidebar, hàng được chọn |
| `blue-600` / `blue-700` | `#2563EB` / `#1D4ED8` | Link, tab, focus ring, thông tin |
| `line` | `#E2E8F0` | Viền, divider |
| `success` / `warning` / `danger` | `#15803D` / `#B45309` / `#B91C1C` | Trạng thái (luôn kèm icon/chữ) |

Mọi cặp chữ/nền dùng thực tế đạt WCAG AA. Mỗi màn hình chỉ có **một** nút `orange-700`.

### Typography
- **Playfair Display** (serif, có đủ dấu tiếng Việt): chỉ tiêu đề lớn ở website công khai (hero 48/56, section 36/44), hợp với nét thanh lịch của logo chữ thảo.
- **Be Vietnam Pro**: toàn bộ LMS và thân bài — h3 24/32 · title 20/28 · reading 18/28 (bài đọc tiếng Anh) · body 16/24 · small 14/20 · label-caps 12/16 giãn chữ.
- Tự host qua `next/font`, không gọi Google lúc runtime.

### Hình khối & khoảng cách
- Bo góc: card `radius-lg 12px`, nút/input `radius-md 10px`, badge `radius-pill`.
- Bóng: rất nhẹ (`0 1px 2px rgb(15 23 42 / .06)`), card nổi khi hover trên desktop.
- Lưới khoảng cách 4 px; khoảng cách section 24 px (mobile) / 32 px (desktop).
- Vùng chạm tối thiểu **44 × 44 px**.
- Icon: lucide-react, nét 1.75 px.

### Component dùng chung
Button (primary / secondary / outline / ghost / destructive; size sm/md/lg; trạng thái loading) · Input, Textarea, Select, Checkbox, Radio, Switch, DatePicker · Modal (Dialog) + Sheet (trượt từ đáy trên mobile) · Card, StatCard · Table (desktop) tự chuyển thành danh sách thẻ trên mobile · Badge (trạng thái bài tập, trình độ, chuyên cần) · Toast (Sonner) · Skeleton loading · EmptyState (icon + câu hướng dẫn + nút hành động) · ErrorState (thông báo dễ hiểu + "Thử lại") · ProgressBar, ProgressRing · Avatar · Tabs · Breadcrumb · Pagination.

Ngôn ngữ giao diện: tiếng Việt, câu ngắn, xưng hô trung tính ("Bạn"). Nhãn kỹ năng giữ tiếng Anh (Listening, Grammar…) vì là thuật ngữ học.

## 3. Điều hướng

| Vai trò | Mobile | Desktop |
|---|---|---|
| Học viên | Bottom nav 5 mục: Trang chủ · Lớp học · Bài tập · Lịch · Tôi | Sidebar thu gọn |
| Phụ huynh | Bottom nav: Tổng quan · Lịch · Bài tập · Thông báo · Tôi; chọn con ở đầu trang | Sidebar |
| Giáo viên | Bottom nav: Tổng quan · Lớp · Chấm bài · Lịch · Thêm | Sidebar đầy đủ |
| Admin | Menu dạng sheet | Sidebar đầy đủ |

## 4. Dashboard GIÁO VIÊN (desktop ≥ 1024 px)

```
┌───────────────┬──────────────────────────────────────────────────────────────┐
│ Sala | ENGLISH│  Chào cô Lan 👋   Thứ Bảy, 07/11/2026        🔔3   (avatar)  │
│               ├──────────────────────────────────────────────────────────────┤
│ ▣ Tổng quan   │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│ ▢ Lớp học     │ │ 4 lớp    │ │ 62 học   │ │ 18 bài   │ │ 9 HV chưa│          │
│ ▢ Chấm bài (18)│ │ đang dạy │ │ viên     │ │ chờ chấm │ │ nộp bài  │          │
│ ▢ Bài giảng   │ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│ ▢ Thư viện    │ ┌───────────── Lịch dạy hôm nay ─────────────┐ ┌─ Cần chấm ─┐ │
│ ▢ Bài tập     │ │ 17:30  STA-2611  Starter A   P.201  [Điểm danh]│ │ Unit 3 Quiz│ │
│ ▢ Lịch dạy    │ │ 19:15  PIN-2609  Pre-Inter   Online [Điểm danh]│ │ 12 bài  →  │ │
│ ▢ Thông báo   │ └────────────────────────────────────────────┘ │ Writing #2 │ │
│               │ ┌──── Điểm trung bình theo lớp (Recharts) ───┐ │ 6 bài   →  │ │
│ ───────────── │ │ ▇▇▇▇▇▇ 8.1  ▇▇▇▇▇ 7.4  ▇▇▇▇▇▇▇ 8.6 ...     │ └────────────┘ │
│ ⚙ Cài đặt     │ └────────────────────────────────────────────┘                │
│               │ ┌──── Học viên chưa nộp (hạn trong 48 giờ) ─────────────────┐ │
│               │ │ Minh Anh · STA-2611 · Unit 3 Quiz · còn 20 giờ [Nhắc]      │ │
│               │ │ Quốc Bảo · PIN-2609 · Listening 5  · quá hạn 1 ngày [Nhắc] │ │
│               │ └───────────────────────────────────────────────────────────┘ │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

Nguyên tắc: thứ GV cần làm **hôm nay** nằm trên cùng (buổi dạy → điểm danh, bài chờ chấm). Mỗi thẻ thống kê bấm được để đi tới danh sách chi tiết. Nút "Tạo nhanh" (bài giảng / bài tập / thông báo) ở header.

**Màn hình chấm bài**: 2 cột trên desktop (bài làm bên trái, ô điểm + nhận xét bên phải, phím tắt sang bài kế tiếp); trên mobile ô chấm là sheet dưới đáy. Có nghe bản ghi Speaking ngay trong trang.

## 5. Dashboard HỌC VIÊN (mobile 360–430 px)

```
┌─────────────────────────────────┐
│ Xin chào, Minh Anh 👋     🔔 2  │
│ Hôm nay: Starter A · 17:30      │
│ ┌─────────────────────────────┐ │
│ │ 🎯 Bài cần làm (3)          │ │
│ │ Unit 3 Quiz     còn 20 giờ  │ │  ← cam khi < 24h
│ │ [   Làm bài ngay   ]        │ │
│ │ Listening 5     còn 3 ngày  │ │
│ │ Writing #2      còn 5 ngày  │ │
│ └─────────────────────────────┘ │
│ ┌──────────── Tiếp tục nghe ──┐ │
│ │ 🎧 At the zoo  ▶  02:14/04:30│ │  ← nhớ vị trí
│ │ ████████░░░░░░░             │ │
│ └─────────────────────────────┘ │
│ ┌──── Điểm gần đây ───────────┐ │
│ │ Unit 2 Quiz   9.0  ⭐ Tốt lắm │ │
│ │ Writing #1    7.5  💬 1 nhận xét│
│ └─────────────────────────────┘ │
│ ┌──── Tiến độ tuần này ───────┐ │
│ │ ◔ 4/6 bài   ◕ Chuyên cần 92%│ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ 🏠    📚     📝     📅     👤  │
│ Trang Lớp   Bài tập Lịch   Tôi  │
└─────────────────────────────────┘
```

Nguyên tắc: một hành động chính rõ ràng ("Làm bài ngay"); mã màu hạn nộp (xanh → cam → đỏ quá hạn); không dùng bảng trên mobile; lời khen ngắn tích cực cho trẻ nhỏ nhưng trung tính với người lớn (dựa trên độ tuổi).

### Màn hình làm bài (mobile)
- Thanh trên: tên bài · đồng hồ đếm ngược · trạng thái lưu ("Đã lưu ✓" / "Đang offline – đã lưu trên máy").
- Mỗi màn 1 câu, nút Trước/Tiếp to ở đáy, lưới số câu để nhảy nhanh (câu đã làm tô màu).
- Matching và Ordering: chạm-chọn (tap-to-select) thay vì kéo thả để dễ dùng trên điện thoại; kéo thả là tùy chọn trên desktop.
- Nộp bài: màn xác nhận liệt kê câu chưa làm.

### Audio player
```
┌─────────────────────────────────┐
│      [ hình minh họa ]          │
│  At the zoo — Listening 5       │
│  ●━━━━━━━━━━○──────────  02:14 / 04:30
│   ⟲10s     ▶ (to)      10s⟳     │
│  Tốc độ: 0.5 0.75 [1x] 1.25 1.5 2│
│  🔊 ━━━━━━○──   🔁 Lặp đoạn A-B   │
│  [ Hiện transcript ▼ ]           │
└─────────────────────────────────┘
```
Dùng thẻ `<audio>` gốc + Media Session API (điều khiển từ màn hình khóa điện thoại). Lưu vị trí mỗi 10 giây và khi tạm dừng/rời trang; mở lại hỏi "Nghe tiếp từ 02:14?". (Lặp đoạn A-B là đề xuất thêm — hữu ích cho luyện nghe, chi phí thấp.)

## 6. Sitemap

### Website công khai
```
/                         Trang chủ (hero, phương pháp, khóa học nổi bật, giáo viên,
│                          hình ảnh, đánh giá, liên hệ, CTA tư vấn)
├── /gioi-thieu           Giới thiệu lớp học
├── /giao-vien            Đội ngũ giáo viên
│   └── /giao-vien/[slug]
├── /khoa-hoc             Danh sách khóa học (lọc theo đối tượng/trình độ)
│   └── /khoa-hoc/[slug]  Chi tiết khóa học + CTA học thử
├── /hinh-anh             Hình ảnh hoạt động
├── /tin-tuc              Tin tức & chia sẻ kiến thức
│   └── /tin-tuc/[slug]
├── /lien-he
├── /dang-ky-hoc-thu
└── /dang-nhap
```

### Cổng LMS (`/app`, không index — `robots: noindex`)
```
/app → chuyển theo vai trò
├── admin/        dashboard · users · classes · courses · teachers · content (posts, gallery,
│                 testimonials) · inquiries · materials · reports · settings
├── teacher/      dashboard · grading · library
├── student/      dashboard · assignments · grades
├── parent/       dashboard · children/[studentId] (lịch, chuyên cần, bài tập, điểm, nhận xét)
├── classes/[classId]/  overview · members · lessons · materials · audio · assignments
│                       · gradebook · attendance · schedule · announcements
├── lessons/[lessonId] · assignments/[assignmentId] · do/[submissionId] · grade/[submissionId]
└── calendar · notifications · profile
```

## 7. Responsive & truy cập
- Breakpoint: `sm 640` · `md 768` · `lg 1024` · `xl 1280`. Thiết kế từ 360 px trở lên.
- Kiểm thử Playwright ở 3 viewport (iPhone SE/12, iPad, desktop 1280).
- Hỗ trợ bàn phím & screen reader nhờ Radix; focus ring rõ; không dùng màu là tín hiệu duy nhất (kèm icon/chữ).
