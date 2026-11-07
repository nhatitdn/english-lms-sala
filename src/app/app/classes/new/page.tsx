import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/design-system/page-header";
import { ClassForm } from "@/features/classes/components/class-form";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Tạo lớp" };

export default async function NewClassPage() {
  await requireRole("ADMIN");
  return (
    <>
      <Link href="/app/classes" className="text-sm text-blue-600 hover:underline">
        ← Lớp học
      </Link>
      <PageHeader title="Tạo lớp" description="Sau khi tạo, bạn phân công giáo viên, thêm học viên và đặt lịch học." className="mt-2" />
      <ClassForm values={{ status: "ACTIVE", startDate: new Date().toISOString().slice(0, 10) }} />
    </>
  );
}
