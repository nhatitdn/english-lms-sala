# API

> Trạng thái: **Bản đề xuất chờ duyệt** — sẽ cập nhật chi tiết theo từng phase.

Ứng dụng là monolith nên phần lớn thao tác của giao diện dùng **Server Actions** (gọi hàm server trực tiếp, có kiểm tra Origin sẵn). **Route Handlers** (`/api/*`) chỉ dùng khi cần HTTP thật: upload/download file, autosave bằng `keepalive`, cron, health check, Auth.js, form công khai.

## 1. Quy ước chung

- Mọi input validate bằng Zod; schema đặt tại `src/features/<module>/schemas.ts`.
- Kết quả Server Action: `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`.
- Route Handler lỗi: HTTP status + JSON `{ error: { code, message } }`.
- Mã lỗi: `UNAUTHENTICATED` (401), `FORBIDDEN` (403 — chỉ dùng cho khu vực theo vai trò), `NOT_FOUND` (404 — cũng dùng khi không có quyền với tài nguyên cụ thể), `VALIDATION_ERROR` (422), `CONFLICT` (409), `RATE_LIMITED` (429), `PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_FILE` (415).
- Thời gian truyền dạng ISO 8601 UTC; client hiển thị theo `Asia/Ho_Chi_Minh`.
- Phân trang: `?page=&pageSize=` (tối đa 100).

## 2. Route Handlers

| Method & đường dẫn | Quyền | Mô tả |
|---|---|---|
| `GET/POST /api/auth/[...nextauth]` | công khai | Auth.js (đăng nhập, đăng xuất, session) |
| `GET /api/health` | công khai | `{ status, db, storage, version }` — Docker healthcheck & giám sát |
| `POST /api/uploads` | đã đăng nhập (theo `purpose`) | multipart: `file`, `purpose` (`lesson`, `audio`, `submission`, `avatar`, `cms`…). Trả `{ fileId, kind, size, durationSec? }` |
| `GET /api/files/:id` | `canAccessFile` | Phát/tải file. Production trả `X-Accel-Redirect`; hỗ trợ Range. `?download=1` để tải về |
| `GET /media/:id/:size` | công khai | Ảnh PUBLIC đã xử lý (website), cache dài hạn |
| `PUT /api/submissions/:id/answers` | học viên chủ bài làm | Tự lưu. Body `{ version, answers: { [questionId]: answer } }` → `{ version, savedAt }`; 409 `{ reason: "version", version }` nếu tab/thiết bị khác đã lưu bản mới hơn; 409 `{ reason: "closed" }` nếu bài đã nộp/hết giờ. Kiểm tra Origin |
| `GET /api/classes/:id/gradebook` | ADMIN, GV của lớp | Bảng điểm CSV (UTF-8 BOM, mở được bằng Excel) |
| `POST /api/audio-progress` | học viên | `{ audioLessonId, positionSec, listenedSec }` — gửi định kỳ & khi rời trang |
| `GET /api/notifications` | đã đăng nhập | Danh sách + số chưa đọc (client hỏi lại mỗi 60 giây khi tab đang mở) |
| `GET /api/calendar?from&to&classId?` | theo vai trò | Buổi học + hạn nộp trong khoảng thời gian (cho lịch tuần/tháng) |
| `POST /api/public/inquiries` | công khai, rate limit, honeypot | Đăng ký học thử / tư vấn / liên hệ |
| `POST /api/cron/:job` | header `Authorization: Bearer CRON_SECRET` | `generate-sessions`, `due-reminders`, `publish-and-close`, `cleanup-files` |
| `GET /sitemap.xml`, `GET /robots.txt` | công khai | Sinh tự động (`app/sitemap.ts`, `app/robots.ts`) |

## 3. Server Actions theo module

| Module | Action | Vai trò |
|---|---|---|
| **auth** | `changePassword`, `logoutAllDevices` | mọi người dùng |
| **users** | `createUser`, `updateUser`, `lockUser`, `resetPassword`, `linkParentStudent`, `unlinkParentStudent`, `importStudentsCsv` | ADMIN |
| **classes** | `createClass`, `updateClass`, `archiveClass`, `assignTeacher`, `removeTeacher` | ADMIN |
| | `addStudentToClass`, `removeStudentFromClass`, `transferStudent`, `createGroup`, `updateGroupMembers` | ADMIN, GV của lớp |
| **schedule** | `upsertSchedule`, `cancelSession`, `rescheduleSession`, `createMakeupSession` | ADMIN, GV của lớp |
| **attendance** | `saveAttendance(sessionId, records[])` | ADMIN, GV của lớp |
| **lessons** | `createLesson`, `updateLesson`, `publishLesson`, `unpublishLesson`, `duplicateLesson`, `setLessonClasses`, `deleteLesson` | GV (bài của mình / lớp mình), ADMIN |
| **materials** | `createMaterial`, `updateMaterial`, `deleteMaterial`, `attachMaterial` | GV, ADMIN |
| **audio** | `createAudioLesson`, `updateAudioLesson` | GV, ADMIN |
| **assignments** | `createAssignmentAction`, `updateAssignmentSettingsAction`, `saveQuestionAction`, `deleteQuestionAction`, `moveQuestionAction`, `setAssignmentStatusAction` (publish/unpublish/close/reopen), `deleteAssignmentAction`, `duplicateAssignmentAction`, `releaseAnswersAction`, `createListeningQuizAction` | Tác giả bài tập, ADMIN |
| | `addTargetAction`, `removeTargetAction` | Tác giả bài tập **và** GV của lớp được giao |
| | `grantExtensionAction`, `excuseStudentAction` | ADMIN, GV của lớp mà học viên nhận bài |
| **submissions** | `startAttemptAction`, `submitAttemptAction` | STUDENT (bài được giao cho mình) |
| **grading** | `gradeSubmissionAction` — điểm từng câu, nhận xét từng câu/chung, sửa tổng điểm (bắt buộc lý do), yêu cầu làm lại | ADMIN, GV của lớp (học viên gọi → FORBIDDEN, có test) |
| **announcements** | `createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement` | GV (lớp mình), ADMIN (toàn trung tâm) |
| **notifications** | `markRead`, `markAllRead` | chủ thông báo |
| **cms** | `upsertCourse`, `upsertPost`, `publishPost`, `upsertTestimonial`, `upsertGalleryImage`, `updateInquiryStatus`, `updateSiteSettings`, `upsertTeacherProfile` | ADMIN |
| **settings** | `updateSystemSettings` (giới hạn upload, phiên…) | ADMIN |

## 4. Dữ liệu đọc (Server Components)

Đọc dữ liệu trực tiếp trong Server Component qua hàm `queries.ts` của từng module (VD `getStudentDashboard(userId)`, `getClassGradebook(classId)`), các hàm này **luôn** nhận user hiện tại và áp dụng policy — không có hàm đọc "không kiểm tra quyền" được export.

## 5. Dữ liệu trả về cho học viên khi làm bài

Màn hình làm bài (`/app/do/:submissionId`, hàm `getAttempt`) chỉ nhận câu hỏi qua `toStudentQuestion()`: **không có** `is_correct`, `match_key`, `correct_position`, `config` (đáp án điền từ, đáp án chấp nhận), `explanation`; cột phải của câu nối và các phần câu sắp xếp đã xáo trộn (cố định theo bài làm). Có unit test, integration test và E2E (kiểm tra cả HTML/RSC payload) xác nhận điều này. Trang kết quả chỉ hiện đáp án khi chế độ *hiện đáp án* cho phép.
