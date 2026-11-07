import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ClassTabs } from "@/features/classes/components/class-tabs";
import { getClassHeader } from "@/features/classes/queries";
import { LEVEL_LABELS } from "@/lib/constants";
import { CLASS_STATUS_LABELS } from "@/lib/labels";
import { formatSchedule } from "@/lib/schedule";
import { requireUser } from "@/server/auth/current-user";
import Link from "next/link";

export default async function ClassLayout({ children, params }: LayoutProps<"/app/classes/[classId]">) {
  const user = await requireUser();
  const { classId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(classId)) notFound();
  const data = await getClassHeader(user, classId);
  if (!data) notFound();
  const { cls, access } = data;

  const tabs = [
    { slug: "", label: "Tổng quan" },
    ...(access.canManage ? [{ slug: "members", label: "Thành viên" }] : []),
    ...(user.role !== "PARENT"
      ? [
          { slug: "lessons", label: "Bài giảng" },
          { slug: "materials", label: "Tài liệu" },
          { slug: "audio", label: "Luyện nghe" },
          { slug: "assignments", label: "Bài tập" },
          { slug: "gradebook", label: access.canManage ? "Bảng điểm" : "Điểm của tôi" },
        ]
      : []),
    { slug: "schedule", label: "Lịch học" },
  ];

  return (
    <>
      <Link href="/app/classes" className="text-sm text-blue-600 hover:underline">
        ← Lớp học
      </Link>
      <div className="mt-2 mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-wide text-ink-muted">{cls.code}</p>
          <h1 className="text-2xl leading-8 font-semibold text-ink">{cls.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <Badge tone="blue">{LEVEL_LABELS[cls.level]}</Badge>
            <Badge tone={cls.status === "ACTIVE" ? "success" : "neutral"}>{CLASS_STATUS_LABELS[cls.status]}</Badge>
            <span>{formatSchedule(cls.schedules)}</span>
          </p>
        </div>
      </div>
      <ClassTabs classId={cls.id} tabs={tabs} />
      {children}
    </>
  );
}
