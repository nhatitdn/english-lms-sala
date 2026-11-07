# BƯỚC 3b — ERD

> Sơ đồ viết bằng Mermaid — xem được trực tiếp trên GitHub, GitLab hoặc VS Code (extension "Markdown Preview Mermaid Support").
> Chi tiết cột: [DATABASE.md](DATABASE.md). Sơ đồ chỉ thể hiện khóa và quan hệ chính.

## 1. Tổng quan các nhóm

```mermaid
flowchart LR
  subgraph USER[User]
    users --- students & teachers & parents
    parents --- parent_students --- students
  end
  subgraph CLASS[Class]
    courses --- classes
    classes --- class_teachers & class_members & class_groups & class_schedules & class_sessions
    class_sessions --- attendance
  end
  subgraph LEARN[Learning]
    lessons --- lesson_classes & lesson_attachments & audio_lessons
    lesson_attachments --- learning_materials --- files
    audio_lessons --- audio_progress
  end
  subgraph ASSIGN[Assignment]
    assignments --- assignment_targets & questions & submissions
    questions --- question_options
    submissions --- submission_answers & submission_files & grades & feedback
  end
  subgraph SYS[System & CMS]
    notifications
    announcements
    activity_logs
    system_settings
    posts
    testimonials
    gallery_images
    inquiries
  end
  USER --> CLASS --> LEARN
  CLASS --> ASSIGN
```

## 2. User & Class

```mermaid
erDiagram
  users ||--o| students : "hồ sơ"
  users ||--o| teachers : "hồ sơ"
  users ||--o| parents : "hồ sơ"
  parents ||--o{ parent_students : ""
  students ||--o{ parent_students : ""

  courses ||--o{ classes : "mở lớp"
  classes ||--o{ class_teachers : ""
  teachers ||--o{ class_teachers : ""
  classes ||--o{ class_members : ""
  students ||--o{ class_members : "lịch sử học"
  classes ||--o{ class_groups : ""
  class_groups ||--o{ class_group_members : ""
  students ||--o{ class_group_members : ""
  classes ||--o{ class_schedules : "lịch định kỳ"
  classes ||--o{ class_sessions : "buổi học"
  class_schedules ||--o{ class_sessions : "sinh ra"
  class_sessions ||--o{ attendance : ""
  students ||--o{ attendance : ""

  users {
    uuid id PK
    citext username UK
    citext email UK
    text password_hash
    enum role
    enum status
    int session_version
  }
  students {
    uuid id PK
    uuid user_id FK,UK
    text student_code UK
    date date_of_birth
    bool is_independent
  }
  teachers {
    uuid id PK
    uuid user_id FK,UK
    text slug UK
    bool is_public
  }
  parents {
    uuid id PK
    uuid user_id FK,UK
  }
  parent_students {
    uuid parent_id PK,FK
    uuid student_id PK,FK
    enum relationship
  }
  courses {
    uuid id PK
    text slug UK
    enum status
  }
  classes {
    uuid id PK
    text code UK
    uuid course_id FK
    enum level
    enum status
    date start_date
    date end_date
  }
  class_teachers {
    uuid class_id PK,FK
    uuid teacher_id PK,FK
    enum role
  }
  class_members {
    uuid id PK
    uuid class_id FK
    uuid student_id FK
    enum status
    timestamptz joined_at
    timestamptz left_at
    uuid transferred_to_class_id FK
  }
  class_groups {
    uuid id PK
    uuid class_id FK
  }
  class_group_members {
    uuid group_id PK,FK
    uuid student_id PK,FK
  }
  class_schedules {
    uuid id PK
    uuid class_id FK
    smallint weekday
    time start_time
    time end_time
  }
  class_sessions {
    uuid id PK
    uuid class_id FK
    uuid schedule_id FK
    timestamptz starts_at
    enum status
  }
  attendance {
    uuid id PK
    uuid session_id FK
    uuid student_id FK
    enum status
  }
```

## 3. Learning

```mermaid
erDiagram
  users ||--o{ files : "upload"
  users ||--o{ lessons : "tác giả"
  lessons ||--o{ lesson_classes : "lớp được xem"
  classes ||--o{ lesson_classes : ""
  lessons ||--o{ lesson_attachments : ""
  learning_materials ||--o{ lesson_attachments : "tái sử dụng"
  files ||--o{ learning_materials : ""
  lessons ||--o{ audio_lessons : ""
  files ||--o{ audio_lessons : "audio, ảnh"
  audio_lessons ||--o{ audio_progress : ""
  students ||--o{ audio_progress : ""
  audio_lessons |o--o| assignments : "Listening Quiz"
  lessons ||--o{ lessons : "copied_from"

  files {
    uuid id PK
    text storage_key UK
    enum visibility
    enum kind
    text mime_type
    bigint size_bytes
  }
  learning_materials {
    uuid id PK
    enum type
    uuid file_id FK
    text url
    enum skill
    text_arr tags
  }
  lessons {
    uuid id PK
    jsonb content
    enum skill
    enum status
    uuid author_id FK
    uuid copied_from_id FK
  }
  lesson_classes {
    uuid lesson_id PK,FK
    uuid class_id PK,FK
    timestamptz visible_from
  }
  lesson_attachments {
    uuid id PK
    uuid lesson_id FK
    uuid material_id FK
  }
  audio_lessons {
    uuid id PK
    uuid lesson_id FK
    uuid audio_file_id FK
    jsonb transcript
    uuid assignment_id FK
  }
  audio_progress {
    uuid audio_lesson_id PK,FK
    uuid student_id PK,FK
    int position_sec
    int play_count
    timestamptz completed_at
  }
```

## 4. Assignment & Grading

```mermaid
erDiagram
  assignments ||--o{ assignment_targets : "giao cho"
  classes ||--o{ assignment_targets : ""
  class_groups |o--o{ assignment_targets : ""
  students |o--o{ assignment_targets : ""
  assignments ||--o{ assignment_extensions : "gia hạn"
  assignments ||--o{ questions : ""
  questions ||--o{ question_options : ""
  assignments ||--o{ submissions : ""
  students ||--o{ submissions : ""
  submissions ||--o{ submission_answers : ""
  questions ||--o{ submission_answers : ""
  submissions ||--o{ submission_files : ""
  files ||--o{ submission_files : ""
  submissions ||--o{ grades : "lịch sử chấm"
  submissions |o--o{ feedback : ""
  students ||--o{ feedback : ""

  assignments {
    uuid id PK
    numeric max_score
    int time_limit_min
    int max_attempts
    enum answer_reveal
    enum status
  }
  assignment_targets {
    uuid id PK
    uuid assignment_id FK
    uuid class_id FK
    enum target_type
    uuid group_id FK
    uuid student_id FK
    timestamptz available_at
    timestamptz due_at
  }
  assignment_extensions {
    uuid id PK
    uuid assignment_id FK
    uuid student_id FK
    timestamptz new_due_at
  }
  questions {
    uuid id PK
    uuid assignment_id FK
    enum type
    numeric points
    jsonb config
  }
  question_options {
    uuid id PK
    uuid question_id FK
    bool is_correct
    text match_key
    int correct_position
  }
  submissions {
    uuid id PK
    uuid assignment_id FK
    uuid student_id FK
    uuid class_id FK
    int attempt_no
    enum status
    timestamptz deadline_at
    numeric final_score
    int version
  }
  submission_answers {
    uuid id PK
    uuid submission_id FK
    uuid question_id FK
    jsonb answer
    numeric auto_points
    numeric manual_points
  }
  submission_files {
    uuid id PK
    uuid submission_id FK
    uuid file_id FK
  }
  grades {
    uuid id PK
    uuid submission_id FK
    numeric score
    enum source
    uuid graded_by FK
    bool is_current
  }
  feedback {
    uuid id PK
    uuid student_id FK
    uuid submission_id FK
    uuid author_id FK
    bool needs_revision
    bool visible_to_parent
  }
```

## 5. System & CMS

```mermaid
erDiagram
  users ||--o{ notifications : "nhận"
  users ||--o{ announcements : "đăng"
  classes |o--o{ announcements : ""
  users |o--o{ activity_logs : "thực hiện"
  users ||--o{ posts : "tác giả"
  files |o--o{ posts : "ảnh bìa"
  files ||--o{ gallery_images : ""
  courses |o--o{ inquiries : "quan tâm"

  notifications {
    uuid id PK
    uuid user_id FK
    enum type
    timestamptz read_at
  }
  announcements {
    uuid id PK
    uuid class_id FK
    bool is_pinned
  }
  activity_logs {
    uuid id PK
    uuid actor_id FK
    text action
    text entity_type
    uuid entity_id
  }
  system_settings {
    text key PK
    jsonb value
  }
  posts {
    uuid id PK
    text slug UK
    enum status
  }
  testimonials {
    uuid id PK
    text display_name
    bool is_published
  }
  gallery_images {
    uuid id PK
    uuid file_id FK
    bool consent_confirmed
    bool is_published
  }
  inquiries {
    uuid id PK
    enum type
    text phone
    enum status
  }
```
