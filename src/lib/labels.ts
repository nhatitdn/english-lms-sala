import type { LessonStatus, MaterialType, Skill, TranscriptMode } from "@/generated/prisma/enums";

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
  AFTER_SUBMIT: "Hiện sau khi nộp bài (giai đoạn 3)",
  HIDDEN: "Ẩn với học viên",
};

export const CLASS_STATUS_LABELS = { PLANNED: "Sắp mở", ACTIVE: "Đang học", COMPLETED: "Đã kết thúc", CANCELLED: "Đã hủy" } as const;
