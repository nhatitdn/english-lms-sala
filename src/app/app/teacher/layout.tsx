import { requireRole } from "@/server/auth/current-user";

export default async function TeacherAreaLayout({ children }: LayoutProps<"/app/teacher">) {
  await requireRole("TEACHER", "ADMIN");
  return children;
}
