import type { AttendanceStatus, Level, ParentRelationship, Role, UserStatus } from "@/generated/prisma/enums";

export const SITE_NAME = "Sala English Corner";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Quản trị",
  TEACHER: "Giáo viên",
  STUDENT: "Học viên",
  PARENT: "Phụ huynh",
};

/** Home route of each role's area. */
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/app/admin",
  TEACHER: "/app/teacher",
  STUDENT: "/app/student",
  PARENT: "/app/parent",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khóa",
  DISABLED: "Ngừng sử dụng",
};

export const LEVEL_LABELS: Record<Level, string> = {
  STARTER: "Starter",
  BEGINNER: "Beginner",
  ELEMENTARY: "Elementary",
  PRE_INTERMEDIATE: "Pre-Intermediate",
  INTERMEDIATE: "Intermediate",
  UPPER_INTERMEDIATE: "Upper-Intermediate",
  ADVANCED: "Advanced",
};

export const RELATIONSHIP_LABELS: Record<ParentRelationship, string> = {
  FATHER: "Bố",
  MOTHER: "Mẹ",
  GUARDIAN: "Người giám hộ",
  OTHER: "Khác",
};

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Có mặt",
  ABSENT: "Vắng",
  EXCUSED: "Vắng có phép",
  LATE: "Đi muộn",
};

/** Minimum password length for every account. */
export const PASSWORD_MIN_LENGTH = 8;
