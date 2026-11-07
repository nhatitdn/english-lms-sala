"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { SKILL_LABELS } from "@/lib/labels";
import { createLessonAction } from "../actions";

export function NewLessonDialog({ classes, defaultClassId, label = "Tạo bài giảng" }: { classes: { id: string; code: string; name: string }[]; defaultClassId?: string; label?: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Plus /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bài giảng mới</DialogTitle>
          <DialogDescription>Bài giảng được tạo ở dạng bản nháp. Bạn soạn nội dung, đính kèm tài liệu và audio rồi mới xuất bản.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          action={(fd) =>
            start(async () => {
              const r = await createLessonAction(fd);
              if (!r.ok) return void setErrors(r.error.fieldErrors ?? { title: [r.error.message] });
              router.push(`/app/lessons/${r.data.id}/edit`);
            })
          }
        >
          <Field id="title" label="Tiêu đề" required error={errors.title}>
            <Input name="title" placeholder="Unit 3 — My family" autoFocus />
          </Field>
          <Field id="skill" label="Phân loại">
            <NativeSelect name="skill" defaultValue="GENERAL">
              {Object.entries(SKILL_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {classes.length > 0 && (
            <Field id="classId" label="Cho lớp" hint="Có thể chọn thêm lớp sau.">
              <NativeSelect name="classId" defaultValue={defaultClassId ?? ""}>
                <option value="">Chưa chọn lớp</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <DialogFooter>
            <Button type="submit" variant="primary" loading={pending}>
              Tạo và soạn nội dung
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
