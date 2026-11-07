import { requireUser } from "@/server/auth/current-user";

/** Students reach lessons through their classes; staff also get the list page. Parents have no lesson access. */
export default async function LessonsLayout({ children }: LayoutProps<"/app/lessons">) {
  await requireUser();
  return children;
}
