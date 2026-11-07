import type { Role } from "@/generated/prisma/enums";

export type NavIcon = "dashboard" | "users" | "palette" | "profile" | "home";
export type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean };

/** Main navigation per role. Items are added here as each phase ships its pages. */
export const NAV_ITEMS: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: "/app/admin", label: "Tổng quan", icon: "dashboard", exact: true },
    { href: "/app/admin/users", label: "Người dùng", icon: "users" },
    { href: "/app/admin/design-system", label: "Giao diện", icon: "palette" },
    { href: "/app/profile", label: "Tài khoản", icon: "profile" },
  ],
  TEACHER: [
    { href: "/app/teacher", label: "Tổng quan", icon: "dashboard", exact: true },
    { href: "/app/profile", label: "Tài khoản", icon: "profile" },
  ],
  STUDENT: [
    { href: "/app/student", label: "Trang chủ", icon: "home", exact: true },
    { href: "/app/profile", label: "Tôi", icon: "profile" },
  ],
  PARENT: [
    { href: "/app/parent", label: "Tổng quan", icon: "dashboard", exact: true },
    { href: "/app/profile", label: "Tài khoản", icon: "profile" },
  ],
};
