import type { Role } from "@/generated/prisma/enums";

export type NavIcon = "dashboard" | "users" | "palette" | "profile" | "home" | "classes" | "lessons" | "library";
export type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean };

/** Main navigation per role. Items are added here as each phase ships its pages. */
export const NAV_ITEMS: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: "/app/admin", label: "Tổng quan", icon: "dashboard", exact: true },
    { href: "/app/classes", label: "Lớp học", icon: "classes" },
    { href: "/app/lessons", label: "Bài giảng", icon: "lessons" },
    { href: "/app/admin/users", label: "Người dùng", icon: "users" },
    { href: "/app/library", label: "Thư viện", icon: "library" },
    { href: "/app/admin/design-system", label: "Giao diện", icon: "palette" },
    { href: "/app/profile", label: "Tài khoản", icon: "profile" },
  ],
  TEACHER: [
    { href: "/app/teacher", label: "Tổng quan", icon: "dashboard", exact: true },
    { href: "/app/classes", label: "Lớp học", icon: "classes" },
    { href: "/app/lessons", label: "Bài giảng", icon: "lessons" },
    { href: "/app/library", label: "Thư viện", icon: "library" },
    { href: "/app/profile", label: "Tài khoản", icon: "profile" },
  ],
  STUDENT: [
    { href: "/app/student", label: "Trang chủ", icon: "home", exact: true },
    { href: "/app/classes", label: "Lớp học", icon: "classes" },
    { href: "/app/profile", label: "Tôi", icon: "profile" },
  ],
  PARENT: [
    { href: "/app/parent", label: "Tổng quan", icon: "dashboard", exact: true },
    { href: "/app/classes", label: "Lớp của con", icon: "classes" },
    { href: "/app/profile", label: "Tài khoản", icon: "profile" },
  ],
};
