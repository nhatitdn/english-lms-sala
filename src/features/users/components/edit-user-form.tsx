"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { updateUserAction } from "../actions";
import { BasicFields, StudentFields, TeacherFields, type UserFieldValues } from "./user-fields";

export function EditUserForm({ id, values, kind }: { id: string; values: UserFieldValues; kind: "student" | "teacher" | "other" }) {
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    formData.set("id", id);
    startTransition(async () => {
      const result = await updateUserAction(formData);
      if (!result.ok) {
        setErrors(result.error.fieldErrors ?? {});
        setFormError(result.error.message);
        return;
      }
      setErrors({});
      setFormError(undefined);
      toast.success(result.message ?? "Đã lưu.");
    });
  }

  return (
    <form action={onSubmit} className="grid gap-5" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <BasicFields errors={errors} values={values} />
      {kind === "student" && <StudentFields errors={errors} values={values} />}
      {kind === "teacher" && <TeacherFields errors={errors} values={values} />}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={pending}>
          Lưu thay đổi
        </Button>
      </div>
    </form>
  );
}
