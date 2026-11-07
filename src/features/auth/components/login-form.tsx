"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginAction, type FormState } from "../actions";

export function LoginForm({ callbackUrl, notice }: { callbackUrl?: string; notice?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, null);
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {notice && !state?.error && <Alert tone="success">{notice}</Alert>}
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <Field id="login" label="Tên đăng nhập hoặc email">
        <Input
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={state?.values?.login}
          required
        />
      </Field>
      <div className="grid gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Mật khẩu
        </label>
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-12" />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute top-0 right-0 grid size-11 place-items-center text-ink-muted"
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>
      <Button type="submit" variant="primary" size="lg" loading={pending} className="mt-1 w-full">
        Đăng nhập
      </Button>
      <p className="text-center text-sm text-ink-muted">Quên mật khẩu? Vui lòng liên hệ giáo viên hoặc quản trị viên để được cấp lại.</p>
    </form>
  );
}
