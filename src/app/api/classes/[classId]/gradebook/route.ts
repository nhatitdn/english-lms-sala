import { getGradebook } from "@/features/assignments/queries";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Gradebook as CSV (UTF-8 with BOM so Excel shows Vietnamese correctly). Class staff only. */
export async function GET(_request: Request, ctx: RouteContext<"/api/classes/[classId]/gradebook">) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response(null, { status: 401 });
  const { classId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(classId)) return new Response(null, { status: 404 });
  const book = await getGradebook(user, classId);
  if (!book || !book.staff) return new Response(null, { status: 404 });
  const cls = await db.class.findUniqueOrThrow({ where: { id: classId }, select: { code: true } });
  const lines = [
    ["Học viên", ...book.assignments.map((a) => `${a.title} (/${a.maxScore})`), "TB thang 10"],
    ...book.students.map((s) => [
      s.name,
      ...s.cells.map((c) => (!c ? "" : c.score !== null && (c.status === "GRADED" || c.status === "NEEDS_REVISION") ? String(c.score) : c.status === "SUBMITTED" ? "chờ chấm" : c.status === "EXCUSED" ? "miễn" : c.missing ? "thiếu" : "")),
      s.average === null ? "" : String(s.average),
    ]),
  ];
  const csv = "﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bang-diem-${cls.code}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
