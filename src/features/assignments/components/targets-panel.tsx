"use client";

import { Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";
import { formatDateTime, localInputToIso } from "@/lib/datetime";
import { addTargetAction, removeTargetAction } from "../actions";

type ClassOption = { id: string; code: string; name: string; groups: { id: string; name: string }[]; students: { id: string; name: string }[] };
type Target = { id: string; classCode: string; label: string; availableAt: Date; dueAt: Date | null; closeAt: Date | null };

export function TargetsPanel({ assignmentId, targets, classes }: { assignmentId: string; targets: Target[]; classes: ClassOption[] }) {
  const router = useRouter();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [type, setType] = useState<"CLASS" | "GROUP" | "STUDENT">("CLASS");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  const cls = classes.find((c) => c.id === classId);

  return (
    <section aria-labelledby="targets-heading" className="grid gap-3">
      <h2 id="targets-heading" className="text-lg font-semibold text-ink">
        Giao cho
      </h2>
      {targets.length === 0 ? (
        <p className="text-sm text-ink-muted">Chưa giao cho ai. Chọn lớp, nhóm hoặc học viên bên dưới.</p>
      ) : (
        <ul className="grid gap-2">
          {targets.map((t) => (
            <li key={t.id} className="flex items-start gap-3 rounded-md border border-line p-3">
              <Users className="mt-0.5 size-5 shrink-0 text-blue-600" aria-hidden />
              <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
                <span className="font-medium text-ink">
                  {t.classCode} · {t.label}
                </span>
                <span className="text-ink-muted">
                  Giao: {formatDateTime(t.availableAt)}
                  {t.availableAt > new Date() && (
                    <Badge tone="gold" className="ml-1">
                      Hẹn giờ
                    </Badge>
                  )}
                </span>
                <span className="text-ink-muted">Hạn nộp: {t.dueAt ? formatDateTime(t.dueAt) : "không có"}</span>
                {t.closeAt && <span className="text-ink-muted">Khóa nhận bài: {formatDateTime(t.closeAt)}</span>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Gỡ ${t.classCode} ${t.label}`}
                disabled={pending}
                onClick={() =>
                  confirm("Gỡ đối tượng này? Học viên sẽ không thấy bài tập nữa (bài đã nộp vẫn được giữ).") &&
                  start(async () => {
                    const r = await removeTargetAction({ assignmentId, targetId: t.id });
                    if (!r.ok) return void toast.error(r.error.message);
                    toast.success(r.message);
                    router.refresh();
                  })
                }
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {classes.length === 0 ? (
        <p className="text-sm text-ink-muted">Bạn chưa phụ trách lớp nào đang học.</p>
      ) : (
        <form
          className="grid gap-3 rounded-lg border border-line bg-sky-50/50 p-4"
          action={(fd) =>
            start(async () => {
              for (const k of ["availableAt", "dueAt", "closeAt"]) {
                const v = localInputToIso(fd.get(`${k}Local`));
                fd.delete(`${k}Local`);
                if (v) fd.set(k, v);
              }
              const r = await addTargetAction(fd);
              if (!r.ok) {
                setErrors(r.error.fieldErrors ?? {});
                return void toast.error(r.error.fieldErrors ? Object.values(r.error.fieldErrors).flat()[0] ?? r.error.message : r.error.message);
              }
              setErrors({});
              toast.success(r.message);
              router.refresh();
            })
          }
        >
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <div className="grid gap-3">
            <Field id="t-class" label="Lớp" error={errors.classId}>
              <NativeSelect name="classId" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="t-type" label="Đối tượng">
              <NativeSelect name="targetType" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                <option value="CLASS">Cả lớp</option>
                <option value="GROUP" disabled={!cls?.groups.length}>
                  Một nhóm{cls?.groups.length ? "" : " (lớp chưa có nhóm)"}
                </option>
                <option value="STUDENT">Từng học viên</option>
              </NativeSelect>
            </Field>
          </div>
          {type === "GROUP" && cls && (
            <Field id="t-group" label="Nhóm" error={errors.groupId}>
              <NativeSelect name="groupId">
                {cls.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          {type === "STUDENT" && cls && (
            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-sm font-medium text-ink">Học viên</legend>
              {cls.students.length === 0 && <p className="text-sm text-ink-muted">Lớp chưa có học viên.</p>}
              <div className="grid gap-1.5 sm:grid-cols-2">
                {cls.students.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-[15px]">
                    <Checkbox name="studentIds" value={s.id} /> {s.name}
                  </label>
                ))}
              </div>
              {errors.studentIds && <p className="text-sm text-danger">{errors.studentIds[0]}</p>}
            </fieldset>
          )}
          <div className="grid gap-3">
            <Field id="t-avail" label="Giao lúc" hint="Trống: giao ngay." error={errors.availableAt}>
              <Input name="availableAtLocal" type="datetime-local" />
            </Field>
            <Field id="t-due" label="Hạn nộp" error={errors.dueAt}>
              <Input name="dueAtLocal" type="datetime-local" />
            </Field>
            <Field id="t-close" label="Khóa nhận bài" hint="Sau thời điểm này không nộp được nữa." error={errors.closeAt}>
              <Input name="closeAtLocal" type="datetime-local" />
            </Field>
          </div>
          <Button type="submit" variant="secondary" loading={pending} className="justify-self-start">
            Giao bài
          </Button>
        </form>
      )}
    </section>
  );
}
