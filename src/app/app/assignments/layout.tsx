import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";

/** Staff manage assignments here, students do them. Parents follow results from the parent portal (Phase 4). */
export default async function AssignmentsLayout({ children }: LayoutProps<"/app/assignments">) {
  const user = await requireUser();
  if (user.role === "PARENT") notFound();
  return children;
}
