"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { changePasswordAction, type FormState } from "../actions";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(changePasswordAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {forced && (
        <Alert tone="info" title="Đặt mật khẩu của riêng bạn">
          Đây là lần đăng nhập đầu tiên (hoặc mật khẩu vừa được cấp lại). Vui lòng đổi sang mật khẩu mới để tiếp tục.
        </Alert>
      )}
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Field id="currentPassword" label={forced ? "Mật khẩu được cấp" : "Mật khẩu hiện tại"} error={fe.currentPassword}>
        <Input name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field id="newPassword" label="Mật khẩu mới" hint={`Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự, dễ nhớ với bạn nhưng khó đoán với người khác.`} error={fe.newPassword}>
        <Input name="newPassword" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required />
      </Field>
      <Field id="confirmPassword" label="Nhập lại mật khẩu mới" error={fe.confirmPassword}>
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        Lưu mật khẩu mới
      </Button>
    </form>
  );
}
