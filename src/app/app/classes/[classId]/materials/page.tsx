import { FolderOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/design-system/states";
import { AttachmentList } from "@/features/lessons/components/attachment-list";
import { getClassHeader } from "@/features/classes/queries";
import { materialsForClass } from "@/features/lessons/queries";
import { requireUser } from "@/server/auth/current-user";

export default async function ClassMaterialsPage({ params }: PageProps<"/app/classes/[classId]/materials">) {
  const user = await requireUser();
  const { classId } = await params;
  const header = await getClassHeader(user, classId);
  if (!header || user.role === "PARENT") notFound();
  const rows = await materialsForClass(user, classId);

  // group by lesson
  const groups = new Map<string, { title: string; items: typeof rows }>();
  for (const r of rows) {
    const g = groups.get(r.lesson.id) ?? { title: r.lesson.title, items: [] };
    g.items.push(r);
    groups.set(r.lesson.id, g);
  }

  if (rows.length === 0) return <EmptyState icon={FolderOpen} title="Chưa có tài liệu" description="Tài liệu đính kèm trong các bài giảng của lớp sẽ hiện ở đây." />;
  return (
    <div className="grid gap-5">
      {[...groups.entries()].map(([lessonId, g]) => (
        <section key={lessonId} className="grid gap-2">
          <h2 className="font-semibold text-ink">
            <Link href={`/app/lessons/${lessonId}`} className="hover:text-blue-700">
              {g.title}
            </Link>
          </h2>
          <AttachmentList items={g.items.map((i) => i.material)} />
        </section>
      ))}
    </div>
  );
}
