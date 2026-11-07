import { requireRole } from "@/server/auth/current-user";

export default async function ParentAreaLayout({ children }: LayoutProps<"/app/parent">) {
  await requireRole("PARENT");
  return children;
}
