# BƯỚC 4 — CẤU TRÚC THƯ MỤC SOURCE CODE

> Trạng thái: **Bản đề xuất chờ duyệt**

Tổ chức **theo nghiệp vụ (feature)**: mỗi module gom schema, service, query, action, component của nó vào một chỗ — dễ tìm, dễ giao việc, dễ tách ra khi mở rộng.

```
english-lms/
├── .env.example                  # mẫu biến môi trường (không chứa bí mật thật)
├── .gitignore                    # chặn .env*, /data, /backups
├── Dockerfile                    # build Next.js standalone, chạy user không phải root
├── docker-compose.yml            # app + postgres + nginx (production)
├── docker-compose.dev.yml        # chỉ postgres cho máy dev
├── package.json
├── README.md
├── docs/                         # tài liệu thiết kế & vận hành
├── docker/
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── conf.d/app.conf       # TLS, rate limit, X-Accel, header bảo mật
│   └── postgres/init.sql         # extension citext, unaccent, pgcrypto
├── scripts/
│   ├── backup.sh                 # pg_dump + nén uploads, xoay vòng 7 bản
│   ├── restore.sh
│   ├── deploy.sh                 # backup → pull → build → migrate deploy → up
│   └── create-admin.ts           # tạo admin đầu tiên (nhập mật khẩu tương tác)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/
│       ├── base.ts               # cài đặt mặc định (mọi môi trường)
│       └── demo.ts               # dữ liệu demo (từ chối chạy ở production)
├── public/                       # chỉ tài nguyên tĩnh của thương hiệu (logo, favicon)
├── src/
│   ├── app/
│   │   ├── (public)/             # WEBSITE CÔNG KHAI — URL tiếng Việt cho SEO
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                       # /
│   │   │   ├── gioi-thieu/page.tsx
│   │   │   ├── giao-vien/page.tsx
│   │   │   ├── giao-vien/[slug]/page.tsx
│   │   │   ├── khoa-hoc/page.tsx
│   │   │   ├── khoa-hoc/[slug]/page.tsx
│   │   │   ├── hinh-anh/page.tsx
│   │   │   ├── tin-tuc/page.tsx
│   │   │   ├── tin-tuc/[slug]/page.tsx
│   │   │   ├── lien-he/page.tsx
│   │   │   └── dang-ky-hoc-thu/page.tsx
│   │   ├── (auth)/
│   │   │   ├── dang-nhap/page.tsx
│   │   │   └── doi-mat-khau/page.tsx
│   │   ├── app/                  # CỔNG LMS — /app/...
│   │   │   ├── layout.tsx        # shell: sidebar (desktop) / bottom nav (mobile)
│   │   │   ├── page.tsx          # chuyển hướng theo vai trò
│   │   │   ├── admin/            # dashboard, users, classes, courses, cms, inquiries, reports, settings
│   │   │   ├── teacher/          # dashboard, grading queue, library
│   │   │   ├── student/          # dashboard, assignments, grades
│   │   │   ├── parent/           # dashboard, children/[studentId]
│   │   │   ├── classes/[classId]/          # trang lớp dùng chung, nội dung theo quyền
│   │   │   │   ├── page.tsx                # tổng quan
│   │   │   │   ├── members/  lessons/  materials/  audio/
│   │   │   │   ├── assignments/  gradebook/  attendance/
│   │   │   │   ├── schedule/  announcements/
│   │   │   ├── lessons/[lessonId]/         # xem / soạn bài giảng
│   │   │   ├── assignments/[assignmentId]/ # soạn, xem kết quả
│   │   │   ├── do/[submissionId]/          # màn hình làm bài (tối ưu mobile)
│   │   │   ├── grade/[submissionId]/       # màn hình chấm bài
│   │   │   ├── calendar/  notifications/  profile/
│   │   ├── api/                  # Route Handlers (xem docs/API.md)
│   │   │   ├── auth/[...nextauth]/  health/  uploads/  files/[id]/
│   │   │   ├── submissions/[id]/  audio-progress/  notifications/
│   │   │   ├── calendar/  public/inquiries/  cron/[job]/
│   │   ├── media/[id]/[size]/route.ts
│   │   ├── sitemap.ts
│   │   ├── robots.ts
│   │   ├── not-found.tsx
│   │   └── error.tsx
│   ├── components/
│   │   ├── ui/                   # shadcn/ui (button, input, dialog, card, table, badge, sonner…)
│   │   ├── design-system/        # EmptyState, ErrorState, PageHeader, StatCard, LoadingSkeleton…
│   │   ├── layout/               # AppShell, Sidebar, BottomNav, PublicHeader, PublicFooter
│   │   ├── audio-player/         # AudioPlayer, Transcript, SpeedControl
│   │   ├── editor/               # RichTextEditor, RichTextRenderer (Tiptap)
│   │   ├── quiz/                 # renderer cho 10 dạng câu hỏi (làm bài + xem lại)
│   │   ├── recorder/             # ghi âm Speaking (MediaRecorder)
│   │   ├── uploader/             # FileDropzone có tiến trình
│   │   └── charts/               # wrapper Recharts
│   ├── features/                 # NGHIỆP VỤ — mỗi thư mục có:
│   │   │                         #   schemas.ts (Zod) · service.ts (ghi) · queries.ts (đọc)
│   │   │                         #   actions.ts (Server Actions) · components/ · *.test.ts
│   │   ├── users/  classes/  schedule/  attendance/
│   │   ├── lessons/  materials/  audio/
│   │   ├── assignments/  submissions/  grading/   # grading/auto-grader.ts: chấm tự động
│   │   ├── notifications/  announcements/  reports/
│   │   ├── cms/  inquiries/  settings/
│   ├── server/                   # hạ tầng phía server (import "server-only")
│   │   ├── db.ts                 # Prisma client + extension soft delete
│   │   ├── auth/                 # cấu hình Auth.js, getCurrentUser, password (argon2)
│   │   ├── authz/                # policies.ts + guards (requireRole, requireClassAccess…)
│   │   ├── storage/              # StorageService (local disk), upload pipeline, validators
│   │   ├── rate-limit.ts
│   │   ├── audit.ts              # ghi activity_logs
│   │   ├── action.ts             # wrapper chuẩn cho Server Action
│   │   └── env.ts                # đọc & validate biến môi trường bằng Zod
│   ├── lib/                      # tiện ích thuần, dùng được ở client
│   │   ├── datetime.ts           # Asia/Ho_Chi_Minh
│   │   ├── format.ts             # VND, điểm, thời lượng
│   │   └── constants.ts          # nhãn tiếng Việt cho enum
│   ├── hooks/                    # useAutosave, useOnlineStatus, useAudioProgress…
│   ├── styles/globals.css        # design tokens (CSS variables)
│   └── middleware.ts             # (proxy) chuyển hướng sớm theo đăng nhập/vai trò
└── tests/
    ├── integration/              # Vitest + Postgres test: service & policy
    ├── e2e/                      # Playwright: luồng nghiệm thu, mobile viewport
    └── fixtures/                 # file mẫu hợp lệ/không hợp lệ (mp3 giả mạo, exe đổi đuôi…)
```

Dữ liệu runtime **ngoài repo**: `/data/uploads` (volume Docker), `/backups` (trên host). Cả hai nằm trong `.gitignore`.
