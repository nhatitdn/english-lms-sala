import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/constants";
import { requireUser } from "@/server/auth/current-user";

export default async function AppIndex() {
  const user = await requireUser();
  redirect(ROLE_HOME[user.role]);
}
