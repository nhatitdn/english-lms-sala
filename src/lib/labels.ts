import type { LessonStatus, MaterialType, Skill, TranscriptMode , AssignmentKind, AssignmentStatus, AnswerReveal, SubmissionStatus } from "@/generated/prisma/enums";

export const SKILL_LABELS: Record<Skill, string> = {
  VOCABULARY: "Vocabulary",
  GRAMMAR: "Grammar",
  LISTENING: "Listening",
  SPEAKING: "Speaking",
  READING: "Reading",
  WRITING: "Writing",
  PRONUNCIATION: "Pronunciation",
  GENERAL: "General Lesson",
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  DOCUMENT: "Tài liệu",
  AUDIO: "Audio",
  VIDEO: "Video",
  IMAGE: "Hình ảnh",
  YOUTUBE: "YouTube",
  LINK: "Link",
};

export const LESSON_STATUS_LABELS: Record<LessonStatus, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Lưu trữ",
};

export const TRANSCRIPT_MODE_LABELS: Record<TranscriptMode, string> = {
  ALWAYS: "Luôn hiển thị",
  AFTER_COMPLETE: "Hiện sau khi nghe xong",
  AFTER_SUBMIT: "Hiện sau khi nộp bài nghe",
  HIDDEN: "Ẩn với học viên",
};

export const CLASS_STATUS_LABELS = { PLANNED: "Sắp mở", ACTIVE: "Đang học", COMPLETED: "Đã kết thúc", CANCELLED: "Đã hủy" } as const;

export const ASSIGNMENT_KIND_LABELS: Record<AssignmentKind, string> = {
  QUIZ: "Trắc nghiệm / Quiz",
  LISTENING: "Luyện nghe",
  WRITING: "Viết",
  SPEAKING: "Nói (ghi âm)",
  FILE_UPLOAD: "Nộp file / ảnh",
  MIXED: "Tổng hợp",
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đang giao",
  CLOSED: "Đã khóa",
  ARCHIVED: "Đã xóa",
};

export const ANSWER_REVEAL_LABELS: Record<AnswerReveal, string> = {
  AFTER_SUBMIT: "Ngay sau khi nộp",
  AFTER_DUE: "Sau hạn nộp",
  MANUAL: "Khi giáo viên cho xem",
  NEVER: "Không hiện đáp án",
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  IN_PROGRESS: "Đang làm",
  SUBMITTED: "Chờ chấm",
  GRADED: "Đã chấm",
  NEEDS_REVISION: "Cần làm lại",
  EXCUSED: "Được miễn",
};

export const SUBMISSION_STATUS_TONES: Record<SubmissionStatus, "blue" | "gold" | "success" | "danger" | "neutral"> = {
  IN_PROGRESS: "blue",
  SUBMITTED: "gold",
  GRADED: "success",
  NEEDS_REVISION: "danger",
  EXCUSED: "neutral",
};
