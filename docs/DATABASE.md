# BƯỚC 3a — THIẾT KẾ DATABASE

> Trạng thái: **Bản đề xuất chờ duyệt** · PostgreSQL 16 · Prisma
> Sơ đồ quan hệ: xem [ERD.md](ERD.md)

## 1. Quy ước

- Tên bảng/cột trong DB: `snake_case` số nhiều (Prisma model PascalCase + `@@map`).
- Khóa chính: `id` kiểu UUID (`uuid` + `gen_random_uuid()`), không lộ số thứ tự.
- Mọi bảng có `created_at`, `updated_at` (`timestamptz`, UTC).
- **Soft delete** (`deleted_at timestamptz null`) cho: `users`, `courses`, `classes`, `lessons`, `learning_materials`, `assignments`, `announcements`, `posts`, `files`. Prisma client extension tự lọc `deleted_at IS NULL`.
- **Không soft delete, không xóa** dữ liệu lịch sử: `submissions`, `submission_answers`, `grades`, `attendance`, `activity_logs`, `class_members`.
- Tiền: `integer`/`bigint` VND. Điểm: `numeric(6,2)`.
- Enum dùng Postgres enum qua Prisma.
- Không lưu file trong DB — chỉ metadata ở bảng `files`.

Ký hiệu: **PK** khóa chính · **FK** khóa ngoại · **UQ** unique · **IX** index · `?` cho phép null.

---

## 2. Nhóm User

### `users`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| username | citext UQ | đăng nhập, bắt buộc |
| email | citext? UQ | |
| phone | text? | |
| password_hash | text | Argon2id |
| full_name | text | |
| avatar_file_id | uuid? FK→files | |
| role | enum `Role` (ADMIN, TEACHER, STUDENT, PARENT) | IX |
| status | enum (ACTIVE, LOCKED, DISABLED) | |
| must_change_password | bool | mặc định true |
| session_version | int | tăng khi đổi mật khẩu / đăng xuất mọi nơi |
| failed_login_count | int | |
| locked_until | timestamptz? | |
| last_login_at | timestamptz? | |
| deleted_at | timestamptz? | |

### `students`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| user_id | uuid UQ FK→users | 1–1 |
| student_code | text UQ | VD `HV0001` |
| date_of_birth | date? | xác định trẻ vị thành niên |
| school | text? | |
| current_level | enum `Level`? | |
| is_independent | bool | học viên người lớn, không cần phụ huynh |
| guardian_consent_at | timestamptz? | thời điểm phụ huynh đồng ý xử lý dữ liệu |
| private_notes | text? | chỉ Admin/GV thấy |

### `teachers`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| user_id | uuid UQ FK→users | (Admin cũng có thể có hồ sơ GV) |
| slug | text UQ | URL trang giới thiệu công khai |
| display_name | text | |
| bio | jsonb? | rich text |
| qualifications | text? | chứng chỉ |
| photo_file_id | uuid? FK→files | ảnh công khai |
| is_public | bool | hiện trên website |
| sort_order | int | |

### `parents`
| Cột | Kiểu |
|---|---|
| id | uuid PK |
| user_id | uuid UQ FK→users |

### `parent_students`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| parent_id | uuid FK→parents | PK(parent_id, student_id) |
| student_id | uuid FK→students | IX |
| relationship | enum (FATHER, MOTHER, GUARDIAN, OTHER) | |

---

## 3. Nhóm Class

### `courses` *(bổ sung — sản phẩm hiển thị công khai)*
id · slug UQ · title · summary · description jsonb · target_audience (enum: KIDS, TEENS, UNIVERSITY, ADULTS) · level enum? · age_min? · age_max? · duration_text · sessions_count? · fee_vnd int? · cover_file_id? · is_featured bool · status (DRAFT, PUBLISHED) · seo_title? · seo_description? · sort_order · deleted_at?

### `classes`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| code | text UQ | mã lớp, VD `STA-2611` |
| name | text | |
| description | text? | |
| course_id | uuid? FK→courses | |
| level | enum `Level` | STARTER, BEGINNER, ELEMENTARY, PRE_INTERMEDIATE, INTERMEDIATE, UPPER_INTERMEDIATE, ADVANCED |
| age_min / age_max | int? | độ tuổi |
| start_date / end_date | date | |
| status | enum (PLANNED, ACTIVE, COMPLETED, CANCELLED) | IX |
| max_students | int? | |
| location | text? | phòng học / link online |
| deleted_at | timestamptz? | |

### `class_teachers` *(bổ sung)*
class_id FK · teacher_id FK · role (MAIN, ASSISTANT) · PK(class_id, teacher_id) · IX(teacher_id)

### `class_members`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| class_id | uuid FK | |
| student_id | uuid FK | IX |
| status | enum (ACTIVE, TRANSFERRED_OUT, LEFT, COMPLETED) | |
| joined_at | timestamptz | |
| left_at | timestamptz? | |
| transferred_to_class_id | uuid? FK→classes | |
| note | text? | |

**UQ một phần**: `(class_id, student_id) WHERE status = 'ACTIVE'` (tạo bằng SQL trong migration). Cho phép một học viên vào lại lớp cũ mà không mất lịch sử.

**Chuyển lớp** = 1 transaction: đặt bản ghi cũ `TRANSFERRED_OUT` + `left_at` + `transferred_to_class_id`, tạo bản ghi `ACTIVE` mới ở lớp mới. Bài nộp, điểm, điểm danh gắn với `student_id` và lớp gốc nên **giữ nguyên lịch sử**.

### `class_groups` / `class_group_members` *(bổ sung — giao bài theo nhóm)*
`class_groups`: id · class_id FK · name · UQ(class_id, name)
`class_group_members`: group_id FK · student_id FK · PK(group_id, student_id)

### `class_schedules` — lịch định kỳ
id · class_id FK · weekday smallint (1=Thứ 2 … 7=CN) · start_time time · end_time time · location? · effective_from date · effective_to date? · IX(class_id)

### `class_sessions` *(bổ sung — buổi học thực tế)*
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| class_id | uuid FK | |
| schedule_id | uuid? FK | null = buổi học bù/thêm |
| starts_at / ends_at | timestamptz | |
| status | enum (SCHEDULED, COMPLETED, CANCELLED, RESCHEDULED) | |
| topic | text? | nội dung buổi |
| note | text? | lý do nghỉ / dời |

UQ(class_id, starts_at) · IX(starts_at)

### `attendance`
id · session_id FK · student_id FK · status enum (PRESENT, ABSENT, EXCUSED, LATE) · note? · marked_by FK→users · marked_at
UQ(session_id, student_id) · IX(student_id)

---

## 4. Nhóm Learning

### `files` *(bổ sung — metadata file dùng chung)*
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| storage_key | text UQ | đường dẫn tương đối, không bao giờ trả ra client |
| visibility | enum (PRIVATE, PUBLIC) | PUBLIC chỉ cho ảnh website |
| kind | enum (IMAGE, DOCUMENT, AUDIO, VIDEO, RECORDING) | |
| original_name | text | đã làm sạch |
| mime_type | text | từ magic bytes |
| extension | text | |
| size_bytes | bigint | |
| sha256 | text | IX — phát hiện trùng |
| duration_sec | int? | audio/video |
| width / height | int? | ảnh |
| uploaded_by | uuid FK→users | IX |
| deleted_at | timestamptz? | |

### `learning_materials` — thư viện tài liệu tái sử dụng
id · title · description? · type enum (DOCUMENT, AUDIO, VIDEO, IMAGE, YOUTUBE, LINK) · file_id? FK · url? · skill enum `Skill`? · tags text[] (IX GIN) · owner_id FK→users · shared_with_teachers bool · deleted_at?
Tìm kiếm: index full-text `to_tsvector('simple', unaccent(title || description))` để tìm không dấu.

### `lessons`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| title | text | |
| description | text? | |
| content | jsonb | Tiptap JSON |
| skill | enum `Skill` | VOCABULARY, GRAMMAR, LISTENING, SPEAKING, READING, WRITING, PRONUNCIATION, GENERAL |
| tags | text[] | chủ đề |
| status | enum (DRAFT, PUBLISHED, ARCHIVED) | |
| author_id | uuid FK→users | |
| copied_from_id | uuid? FK→lessons | khi sao chép |
| published_at | timestamptz? | |
| deleted_at | timestamptz? | |

### `lesson_classes` *(bổ sung — chọn lớp được xem)*
lesson_id FK · class_id FK · visible_from timestamptz? · sort_order · PK(lesson_id, class_id) · IX(class_id)

### `lesson_attachments`
id · lesson_id FK · material_id FK→learning_materials · sort_order · UQ(lesson_id, material_id)
(Đính kèm luôn đi qua thư viện → tự động tái sử dụng được.)

### `audio_lessons`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| lesson_id | uuid FK→lessons | quyền xem kế thừa từ bài giảng |
| title | text | |
| instructions | jsonb? | |
| audio_file_id | uuid FK→files | |
| cover_file_id | uuid? FK→files | hình minh họa |
| transcript | jsonb? | |
| transcript_mode | enum (ALWAYS, AFTER_COMPLETE, AFTER_SUBMIT, HIDDEN) | |
| assignment_id | uuid? FK→assignments | câu hỏi Listening Quiz |
| complete_threshold | smallint | % nghe để tính hoàn thành, mặc định 90 |
| sort_order | int | |

### `audio_progress` *(bổ sung — ghi nhớ vị trí, thống kê)*
audio_lesson_id FK · student_id FK · position_sec · listened_sec · play_count · completed_at? · updated_at
PK(audio_lesson_id, student_id)

---

## 5. Nhóm Assignment

### `assignments`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| title, description | text | |
| instructions | jsonb? | |
| kind | enum (QUIZ, LISTENING, WRITING, SPEAKING, FILE_UPLOAD, MIXED) | để lọc/hiển thị |
| max_score | numeric(6,2) | |
| time_limit_min | int? | null = không giới hạn |
| max_attempts | int? | null = không giới hạn |
| allow_late | bool | |
| answer_reveal | enum (NEVER, AFTER_SUBMIT, AFTER_DUE, MANUAL) | |
| answers_released_at | timestamptz? | cho chế độ MANUAL |
| shuffle_questions / shuffle_options | bool | |
| status | enum (DRAFT, PUBLISHED, CLOSED, ARCHIVED) | |
| created_by | uuid FK→users | |
| deleted_at | timestamptz? | |

### `assignment_targets` — giao cho lớp / nhóm / học viên
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| assignment_id | uuid FK | IX |
| class_id | uuid FK | lớp áp dụng (luôn có) |
| target_type | enum (CLASS, GROUP, STUDENT) | |
| group_id | uuid? FK | |
| student_id | uuid? FK | |
| available_at | timestamptz | ngày giao (lên lịch) |
| due_at | timestamptz? | hạn nộp |
| close_at | timestamptz? | sau thời điểm này không nhận bài kể cả nộp muộn |

CHECK ràng buộc đúng cột theo `target_type`. IX(class_id, available_at), IX(student_id).

### `assignment_extensions` *(bổ sung — gia hạn từng học viên)*
id · assignment_id FK · student_id FK · new_due_at · granted_by FK→users · reason? · UQ(assignment_id, student_id)

### `questions`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| assignment_id | uuid FK | |
| type | enum `QuestionType` | MULTIPLE_CHOICE, MULTIPLE_SELECT, TRUE_FALSE, FILL_BLANK, MATCHING, ORDERING, SHORT_ANSWER, WRITING, SPEAKING, FILE_UPLOAD |
| prompt | jsonb | đề bài rich text |
| media_file_id | uuid? FK | ảnh/audio của câu |
| points | numeric(6,2) | |
| config | jsonb | cấu hình riêng từng dạng (xem dưới) |
| explanation | jsonb? | giải thích hiện khi được xem đáp án |
| sort_order | int | |

`config` theo dạng (validate bằng Zod discriminated union):
- FILL_BLANK: `{ blanks: [{ id, accepted: ["went","had gone"], caseSensitive: false }] }`, đề bài chứa `{{blank:id}}`.
- MULTIPLE_SELECT: `{ scoring: "ALL_OR_NOTHING" | "PARTIAL" }`.
- SHORT_ANSWER: `{ acceptedAnswers?: [] }` → nếu có thì gợi ý điểm tự động, GV vẫn xác nhận.
- WRITING: `{ minWords?, maxWords?, rubric? }`.
- SPEAKING: `{ maxDurationSec: 120 }`. FILE_UPLOAD: `{ allowedKinds: [...], maxFiles }`.

### `question_options`
id · question_id FK · content jsonb · is_correct bool · match_side enum (LEFT, RIGHT)? · match_key text? · correct_position int? · sort_order
- MC / MS / TF: dùng `is_correct`.
- MATCHING: cặp đúng là 2 option LEFT/RIGHT cùng `match_key`.
- ORDERING: thứ tự đúng theo `correct_position`.

### `submissions`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| assignment_id | uuid FK | |
| student_id | uuid FK | |
| class_id | uuid FK | lớp tại thời điểm làm bài (giữ lịch sử khi chuyển lớp) |
| attempt_no | int | |
| status | enum (IN_PROGRESS, SUBMITTED, GRADED, NEEDS_REVISION, EXCUSED) | |
| started_at | timestamptz | |
| deadline_at | timestamptz? | do server tính |
| submitted_at | timestamptz? | |
| is_late | bool | |
| auto_score | numeric? | |
| final_score | numeric? | bản sao điểm hiện hành (lấy từ `grades`) |
| version | int | chống ghi đè khi autosave |
| last_saved_at | timestamptz | |

UQ(assignment_id, student_id, attempt_no) · IX(student_id, status) · IX(assignment_id, status)

### `submission_answers`
id · submission_id FK · question_id FK · answer jsonb · is_correct bool? · auto_points numeric? · manual_points numeric? · UQ(submission_id, question_id)

### `submission_files`
id · submission_id FK · question_id? FK · file_id FK · IX(submission_id)

### `grades` — lịch sử chấm (chỉ thêm, không sửa)
id · submission_id FK · score numeric · max_score numeric · source enum (AUTO, MANUAL) · graded_by? FK→users · reason? · is_current bool · created_at
UQ một phần: `(submission_id) WHERE is_current`. Học viên không có quyền ghi bảng này ở bất kỳ API nào.

### `feedback`
id · student_id FK · class_id FK · submission_id? FK · question_id? FK · author_id FK→users · content text · needs_revision bool · visible_to_parent bool · created_at
IX(student_id, created_at)

---

## 6. Nhóm System

### `notifications`
id · user_id FK · type enum (ASSIGNMENT_NEW, ASSIGNMENT_DUE_SOON, ASSIGNMENT_GRADED, SCHEDULE_CHANGED, SESSION_CANCELLED, ANNOUNCEMENT, SYSTEM) · title · body? · link? · data jsonb? · read_at? · created_at
IX(user_id, read_at, created_at DESC) · UQ(user_id, type, dedupe_key) để không gửi trùng "sắp đến hạn".

### `announcements`
id · class_id? FK (null = toàn trung tâm) · author_id FK · title · content jsonb · is_pinned · published_at? · deleted_at?

### `activity_logs`
id · actor_id? FK · action text (VD `grade.update`) · entity_type · entity_id · metadata jsonb · ip inet? · user_agent? · created_at
IX(entity_type, entity_id) · IX(actor_id, created_at). Giữ 12 tháng.

### `system_settings`
key text PK · value jsonb · updated_by? · updated_at
Ví dụ khóa: `upload.limits`, `site.contact`, `site.socials`, `security.session`, `homepage.sections`.

### `rate_limit_buckets` *(bổ sung)*
key text PK (VD `login:ip:1.2.3.4`) · count int · window_start timestamptz · IX(window_start) để dọn.

---

## 7. Nhóm Public / CMS *(bổ sung)*

| Bảng | Cột chính |
|---|---|
| `posts` | id · slug UQ · title · excerpt · content jsonb · cover_file_id? · category · tags text[] · status (DRAFT, PUBLISHED) · published_at · author_id · seo_title? · seo_description? · deleted_at? |
| `testimonials` | id · display_name ("Chị H.") · role_label ("Phụ huynh bé lớp Starter") · content · rating? · photo_file_id? · is_published · sort_order |
| `gallery_images` | id · file_id FK (PUBLIC) · caption? · album? · taken_on? · **consent_confirmed bool** · is_published · sort_order. CHECK: `is_published → consent_confirmed` |
| `inquiries` | id · type (TRIAL, CONSULT, CONTACT) · full_name · phone · email? · learner_age? · course_id? · preferred_time? · message? · status (NEW, CONTACTED, SCHEDULED, ENROLLED, CLOSED) · handled_by? · internal_note? · ip_hash · created_at |

---

## 8. Seed & dữ liệu

- `prisma/seed/base.ts` — chạy ở mọi môi trường: cài đặt hệ thống mặc định. Tài khoản admin đầu tiên tạo bằng lệnh `npm run create-admin` (nhập mật khẩu tương tác), **không** có mật khẩu cố định trong code.
- `prisma/seed/demo.ts` — dữ liệu demo (lớp, học viên giả, bài tập mẫu). Chỉ chạy khi `SEED_DEMO=true` **và** `NODE_ENV !== "production"`; script tự từ chối nếu phát hiện môi trường production.

## 9. Migration an toàn

- Dev: `prisma migrate dev`. Production: chỉ `prisma migrate deploy` (không bao giờ `db push` / `migrate reset`).
- Script deploy **tự backup DB trước khi migrate**.
- Migration xóa/đổi tên cột → làm 2 bước (thêm mới + chuyển dữ liệu, sau đó mới xóa ở bản sau) và cần bạn xác nhận.
