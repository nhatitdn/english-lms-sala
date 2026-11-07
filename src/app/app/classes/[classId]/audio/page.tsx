import { CheckCircle2, Headphones, PlayCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/design-system/states";
import { Badge } from "@/components/ui/badge";
import { getClassHeader } from "@/features/classes/queries";
import { audioForClass } from "@/features/lessons/queries";
import { requireUser } from "@/server/auth/current-user";

export default async function ClassAudioPage({ params }: PageProps<"/app/classes/[classId]/audio">) {
  const user = await requireUser();
  const { classId } = await params;
  const header = await getClassHeader(user, classId);
  if (!header || user.role === "PARENT") notFound();
  const { items, memberCount } = await audioForClass(user, classId);
  const manager = header.access.canManage;

  if (items.length === 0) return <EmptyState icon={Headphones} title="Chưa có bài nghe" description="Bài nghe trong các bài giảng của lớp sẽ hiện ở đây." />;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((a) => {
        const mine = !manager ? a.progress[0] : undefined;
        const done = manager ? a.progress.filter((p) => p.completedAt).length : 0;
        return (
          <li key={a.id}>
            <Link href={`/app/lessons/${a.lesson.id}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 shadow-card hover:shadow-raised">
              {a.coverFileId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${a.coverFileId}`} alt="" className="size-14 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="grid size-14 shrink-0 place-items-center rounded-md bg-orange-50 text-orange-700">
                  <Headphones className="size-6" />
                </span>
              )}
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate font-semibold text-ink">{a.title}</span>
                <span className="truncate text-sm text-ink-muted">{a.lesson.title}</span>
              </span>
              {manager ? (
                <Badge tone={done === memberCount && memberCount > 0 ? "success" : "blue"}>
                  {done}/{memberCount} nghe xong
                </Badge>
              ) : mine?.completedAt ? (
                <CheckCircle2 className="size-6 shrink-0 text-success" aria-label="Đã nghe xong" />
              ) : (
                <PlayCircle className="size-6 shrink-0 text-orange-700" aria-label={mine ? "Đang nghe" : "Chưa nghe"} />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
