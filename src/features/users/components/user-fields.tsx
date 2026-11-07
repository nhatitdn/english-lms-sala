"use client";

import { Field } from "@/components/ui/field";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { LEVEL_LABELS } from "@/lib/constants";

type Errors = Record<string, string[] | undefined>;
export type UserFieldValues = Partial<{
  username: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  school: string;
  currentLevel: string;
  isIndependent: boolean;
  guardianConsent: boolean;
  privateNotes: string;
  displayName: string;
  qualifications: string;
}>;

export function BasicFields({ errors, values = {} }: { errors: Errors; values?: UserFieldValues }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="fullName" label="Họ và tên" required error={errors.fullName}>
        <Input name="fullName" defaultValue={values.fullName} autoComplete="off" />
      </Field>
      <Field id="username" label="Tên đăng nhập" required hint="Chữ thường không dấu, VD: minhanh.nguyen" error={errors.username}>
        <Input name="username" defaultValue={values.username} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" />
      </Field>
      <Field id="phone" label="Số điện thoại" error={errors.phone}>
        <Input name="phone" type="tel" inputMode="tel" defaultValue={values.phone} />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
        <Input name="email" type="email" inputMode="email" defaultValue={values.email} autoCapitalize="none" />
      </Field>
    </div>
  );
}

export function StudentFields({ errors, values = {} }: { errors: Errors; values?: UserFieldValues }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="dateOfBirth" label="Ngày sinh" error={errors.dateOfBirth}>
        <Input name="dateOfBirth" type="date" defaultValue={values.dateOfBirth} />
      </Field>
      <Field id="currentLevel" label="Trình độ hiện tại" error={errors.currentLevel}>
        <NativeSelect name="currentLevel" defaultValue={values.currentLevel ?? ""}>
          <option value="">Chưa xác định</option>
          {Object.entries(LEVEL_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id="school" label="Trường / nơi làm việc" error={errors.school} className="sm:col-span-2">
        <Input name="school" defaultValue={values.school} />
      </Field>
      <label className="flex items-start gap-3 sm:col-span-2">
        <Checkbox name="isIndependent" defaultChecked={values.isIndependent} className="mt-0.5" />
        <span className="text-sm">
          <span className="font-medium text-ink">Học viên tự quản lý tài khoản</span>
          <span className="block text-ink-muted">Dành cho học viên người lớn, không cần liên kết phụ huynh.</span>
        </span>
      </label>
      <label className="flex items-start gap-3 sm:col-span-2">
        <Checkbox name="guardianConsent" defaultChecked={values.guardianConsent} className="mt-0.5" />
        <span className="text-sm">
          <span className="font-medium text-ink">Phụ huynh đã đồng ý cho lớp lưu thông tin học tập của con</span>
          <span className="block text-ink-muted">Bắt buộc với học viên dưới 18 tuổi.</span>
        </span>
      </label>
      <Field id="privateNotes" label="Ghi chú nội bộ" hint="Chỉ quản trị viên và giáo viên thấy." error={errors.privateNotes} className="sm:col-span-2">
        <Textarea name="privateNotes" defaultValue={values.privateNotes} rows={3} />
      </Field>
    </div>
  );
}

export function TeacherFields({ errors, values = {} }: { errors: Errors; values?: UserFieldValues }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="displayName" label="Tên hiển thị" hint="VD: Cô Lan, Thầy Minh" error={errors.displayName}>
        <Input name="displayName" defaultValue={values.displayName} />
      </Field>
      <Field id="qualifications" label="Bằng cấp / chứng chỉ" error={errors.qualifications}>
        <Input name="qualifications" defaultValue={values.qualifications} />
      </Field>
    </div>
  );
}
