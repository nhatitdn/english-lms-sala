import { requireRole } from "@/server/auth/current-user";

export default async function AdminAreaLayout({ children }: LayoutProps<"/app/admin">) {
  await requireRole("ADMIN");
  return children;
}
