"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { LEVEL_LABELS } from "@/lib/constants";
import { CLASS_STATUS_LABELS } from "@/lib/labels";
import { createClassAction, updateClassAction } from "../actions";

export type ClassFormValues = Partial<{
  code: string;
  name: string;
  description: string;
  level: string;
  ageMin: number | null;
  ageMax: number | null;
  startDate: string;
  endDate: string;
  status: string;
  maxStudents: number | null;
  location: string;
}>;

export function ClassForm({ id, values = {} }: { id?: string; values?: ClassFormValues }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    if (id) fd.set("id", id);
    start(async () => {
      const r = id ? await updateClassAction(fd) : await createClassAction(fd);
      if (!r.ok) {
        setErrors(r.error.fieldErrors ?? {});
        setFormError(r.error.message);
        return;
      }
      toast.success(r.message);
      const target = id ?? (r.data as { id: string }).id;
      router.push(`/app/classes/${target}`);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="grid max-w-3xl gap-4" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <Card>
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-2 sm:pt-6">
          <Field id="code" label="Mã lớp" required hint="VD: STA-2611" error={errors.code}>
            <Input name="code" defaultValue={values.code} autoCapitalize="characters" />
          </Field>
          <Field id="name" label="Tên lớp" required error={errors.name}>
            <Input name="name" defaultValue={values.name} placeholder="Starter A" />
          </Field>
          <Field id="level" label="Trình độ" required error={errors.level}>
            <NativeSelect name="level" defaultValue={values.level ?? ""}>
              <option value="" disabled>
                Chọn trình độ
              </option>
              {Object.entries(LEVEL_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="status" label="Trạng thái" error={errors.status}>
            <NativeSelect name="status" defaultValue={values.status ?? "PLANNED"}>
              {Object.entries(CLASS_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="ageMin" label="Tuổi từ" error={errors.ageMin}>
              <Input name="ageMin" type="number" inputMode="numeric" min={3} max={99} defaultValue={values.ageMin ?? ""} />
            </Field>
            <Field id="ageMax" label="đến" error={errors.ageMax}>
              <Input name="ageMax" type="number" inputMode="numeric" min={3} max={99} defaultValue={values.ageMax ?? ""} />
            </Field>
          </div>
          <Field id="maxStudents" label="Sĩ số tối đa" error={errors.maxStudents}>
            <Input name="maxStudents" type="number" inputMode="numeric" min={1} defaultValue={values.maxStudents ?? ""} />
          </Field>
          <Field id="startDate" label="Ngày bắt đầu" required error={errors.startDate}>
            <Input name="startDate" type="date" defaultValue={values.startDate} />
          </Field>
          <Field id="endDate" label="Ngày kết thúc" error={errors.endDate}>
            <Input name="endDate" type="date" defaultValue={values.endDate} />
          </Field>
          <Field id="location" label="Phòng học / link học online" error={errors.location} className="sm:col-span-2">
            <Input name="location" defaultValue={values.location} placeholder="Phòng 201" />
          </Field>
          <Field id="description" label="Mô tả" error={errors.description} className="sm:col-span-2">
            <Textarea name="description" defaultValue={values.description} rows={3} />
          </Field>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Hủy
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {id ? "Lưu thay đổi" : "Tạo lớp"}
        </Button>
      </div>
    </form>
  );
}
