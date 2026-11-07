"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Role } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Checkbox, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { createUserAction } from "../actions";
import { TempPasswordDialog } from "./temp-password-dialog";
import { BasicFields, StudentFields, TeacherFields } from "./user-fields";

const ROLES: Role[] = ["STUDENT", "PARENT", "TEACHER", "ADMIN"];

export function CreateUserForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("STUDENT");
  const [setOwnPassword, setSetOwnPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string>();
  const [created, setCreated] = useState<{ id: string; username: string; tempPassword: string | null } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    formData.set("role", role);
    startTransition(async () => {
      const result = await createUserAction(formData);
      if (!result.ok) {
        setErrors(result.error.fieldErrors ?? {});
        setFormError(result.error.message);
        return;
      }
      setErrors({});
      setFormError(undefined);
      if (result.data.tempPassword) {
        setCreated(result.data);
      } else {
        toast.success("Đã tạo tài khoản.");
        router.push(`/app/admin/users/${result.data.id}`);
      }
    });
  }

  return (
    <>
      <form action={onSubmit} className="grid max-w-3xl gap-4" noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Card>
          <CardHeader>
            <CardTitle>Vai trò</CardTitle>
          </CardHeader>
          <CardContent>
            <div role="radiogroup" aria-label="Vai trò" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "h-11 rounded-md border text-sm font-medium transition-colors",
                    role === r ? "border-blue-600 bg-sky-100 text-blue-700" : "border-line bg-surface text-ink hover:bg-sky-50",
                  )}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin tài khoản</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <BasicFields errors={errors} />
            <label className="flex items-center gap-3 text-sm">
              <Checkbox checked={setOwnPassword} onChange={(e) => setSetOwnPassword(e.target.checked)} />
              <span className="text-ink">Tự đặt mật khẩu (mặc định hệ thống tạo mật khẩu tạm)</span>
            </label>
            {setOwnPassword && (
              <Field id="password" label="Mật khẩu ban đầu" hint="Người dùng vẫn phải đổi mật khẩu khi đăng nhập lần đầu." error={errors.password}>
                <Input name="password" type="text" autoComplete="new-password" />
              </Field>
            )}
            {role === "ADMIN" && (
              <label className="flex items-center gap-3 text-sm">
                <Checkbox name="alsoTeacher" />
                <span className="text-ink">Quản trị viên này cũng dạy lớp (tạo hồ sơ giáo viên)</span>
              </label>
            )}
          </CardContent>
        </Card>

        {role === "STUDENT" && (
          <Card>
            <CardHeader>
              <CardTitle>Thông tin học viên</CardTitle>
            </CardHeader>
            <CardContent>
              <StudentFields errors={errors} />
            </CardContent>
          </Card>
        )}
        {role === "TEACHER" && (
          <Card>
            <CardHeader>
              <CardTitle>Thông tin giáo viên</CardTitle>
            </CardHeader>
            <CardContent>
              <TeacherFields errors={errors} />
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            Tạo tài khoản
          </Button>
        </div>
      </form>

      {created?.tempPassword && (
        <TempPasswordDialog
          open
          onOpenChange={(open) => {
            if (!open) router.push(`/app/admin/users/${created.id}`);
          }}
          username={created.username}
          password={created.tempPassword}
          title="Đã tạo tài khoản"
        >
          <Button variant="outline" onClick={() => router.push(`/app/admin/users/${created.id}`)}>
            Xem tài khoản
          </Button>
        </TempPasswordDialog>
      )}
    </>
  );
}
