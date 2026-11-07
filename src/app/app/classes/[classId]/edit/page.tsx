import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClassForm } from "@/features/classes/components/class-form";
import { getClassHeader } from "@/features/classes/queries";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Sửa lớp" };

export default async function EditClassPage({ params }: PageProps<"/app/classes/[classId]/edit">) {
  const user = await requireRole("ADMIN");
  const { classId } = await params;
  const data = await getClassHeader(user, classId);
  if (!data) notFound();
  const c = data.cls;
  return (
    <ClassForm
      id={c.id}
      values={{
        code: c.code,
        name: c.name,
        description: c.description ?? "",
        level: c.level,
        ageMin: c.ageMin,
        ageMax: c.ageMax,
        startDate: c.startDate.toISOString().slice(0, 10),
        endDate: c.endDate?.toISOString().slice(0, 10) ?? "",
        status: c.status,
        maxStudents: c.maxStudents,
        location: c.location ?? "",
      }}
    />
  );
}
