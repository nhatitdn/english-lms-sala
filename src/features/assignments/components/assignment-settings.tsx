"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import type { AnswerReveal, AssignmentKind } from "@/generated/prisma/enums";
import { ANSWER_REVEAL_LABELS, ASSIGNMENT_KIND_LABELS } from "@/lib/labels";
import { updateAssignmentSettingsAction } from "../actions";

export type SettingsValue = {
  id: string;
  title: string;
  description: string | null;
  kind: AssignmentKind;
  maxScore: number;
  timeLimitMin: number | null;
  maxAttempts: number | null;
  allowLate: boolean;
  answerReveal: AnswerReveal;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
};

export function AssignmentSettingsForm({ value, totalPoints }: { value: SettingsValue; totalPoints: number }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-4"
      action={(fd) =>
        start(async () => {
          for (const k of ["allowLate", "shuffleQuestions", "shuffleOptions"]) fd.set(k, fd.get(k) ? "true" : "false");
          const r = await updateAssignmentSettingsAction(fd);
          if (!r.ok) {
            setErrors(r.error.fieldErrors ?? {});
            return void toast.error(r.error.message);
          }
          setErrors({});
          toast.success(r.message);
          router.refresh();
        })
      }
    >
      <input type="hidden" name="id" value={value.id} />
      <Field id="title" label="Tên bài tập" required error={errors.title}>
        <Input name="title" defaultValue={value.title} />
      </Field>
      <Field id="description" label="Hướng dẫn cho học viên" error={errors.description}>
        <Textarea name="description" defaultValue={value.description ?? ""} rows={3} placeholder="VD: Làm bài trong 15 phút, không dùng từ điển." />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Field id="kind" label="Loại bài">
          <NativeSelect name="kind" defaultValue={value.kind}>
            {Object.entries(ASSIGNMENT_KIND_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="maxScore" label="Thang điểm" hint={`Tổng điểm các câu (${totalPoints}) được quy đổi về thang này.`} error={errors.maxScore}>
          <Input name="maxScore" type="number" min={1} max={100} step={0.5} inputMode="decimal" defaultValue={value.maxScore} />
        </Field>
        <Field id="timeLimitMin" label="Giới hạn thời gian (phút)" hint="Để trống: không giới hạn." error={errors.timeLimitMin}>
          <Input name="timeLimitMin" type="number" min={1} max={600} inputMode="numeric" defaultValue={value.timeLimitMin ?? ""} />
        </Field>
        <Field id="maxAttempts" label="Số lần được làm" hint="Để trống: không giới hạn." error={errors.maxAttempts}>
          <Input name="maxAttempts" type="number" min={1} max={20} inputMode="numeric" defaultValue={value.maxAttempts ?? ""} />
        </Field>
        <Field id="answerReveal" label="Hiện đáp án cho học viên">
          <NativeSelect name="answerReveal" defaultValue={value.answerReveal}>
            {Object.entries(ANSWER_REVEAL_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-[15px]">
          <Checkbox name="allowLate" defaultChecked={value.allowLate} /> Cho nộp sau hạn (bài nộp muộn được đánh dấu “Nộp muộn”)
        </label>
        <label className="flex items-center gap-2 text-[15px]">
          <Checkbox name="shuffleQuestions" defaultChecked={value.shuffleQuestions} /> Xáo trộn thứ tự câu hỏi
        </label>
        <label className="flex items-center gap-2 text-[15px]">
          <Checkbox name="shuffleOptions" defaultChecked={value.shuffleOptions} /> Xáo trộn thứ tự lựa chọn trắc nghiệm
        </label>
      </div>
      <Button type="submit" variant="outline" loading={pending} className="justify-self-start">
        Lưu cài đặt
      </Button>
    </form>
  );
}
