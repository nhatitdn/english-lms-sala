import { requireRole } from "@/server/auth/current-user";

export default async function StudentAreaLayout({ children }: LayoutProps<"/app/student">) {
  await requireRole("STUDENT");
  return children;
}
