"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { formatScore } from "@/lib/format";
import { gradeSubmissionAction } from "../actions";

export type GradingItem = {
  questionId: string;
  index: number;
  max: number;
  autoPoints: number | null;
  manualPoints: number | null;
  needsManual: boolean;
  isCorrect: boolean | null;
  /** server-rendered prompt + answer + correct answer */
  body: React.ReactNode;
};

/**
 * Per-question points (pre-filled with the auto score), comments, overall comment, optional total
 * override (needs a reason) and "needs revision". Live total preview on the assignment's scale.
 */
export function GradingForm({ submissionId, items, maxScore, totalPoints, nextHref }: { submissionId: string; items: GradingItem[]; maxScore: number; totalPoints: number; nextHref: string | null }) {
  const router = useRouter();
  const [points, setPoints] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.questionId, i.manualPoints !== null ? String(i.manualPoints) : i.autoPoints !== null ? String(i.autoPoints) : ""])),
  );
  const [comments, setComments] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [needsRevision, setNeedsRevision] = useState(false);
  const [override, setOverride] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();

  const earned = items.reduce((s, i) => s + (Number(points[i.questionId]) || 0), 0);
  const scaled = totalPoints > 0 ? Math.round((earned / totalPoints) * maxScore * 100) / 100 : 0;
  const missing = items.filter((i) => i.needsManual && points[i.questionId] === "").length;

  function save(next: boolean) {
    start(async () => {
      const r = await gradeSubmissionAction({
        submissionId,
        questions: items.map((i) => ({ questionId: i.questionId, points: points[i.questionId] === "" ? null : Number(points[i.questionId]), comment: comments[i.questionId] || undefined })),
        comment: comment || undefined,
        needsRevision,
        scoreOverride: override === "" ? null : Number(override),
        reason: reason || undefined,
      });
      if (!r.ok) {
        setErrors(r.error.fieldErrors ?? {});
        return void toast.error(r.error.message);
      }
      toast.success(r.message);
      if (next && nextHref) router.push(nextHref);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <ol className="grid gap-3">
        {items.map((i) => (
          <li key={i.questionId} className="rounded-lg border border-line bg-surface p-4 shadow-card" data-testid="grade-question">
            <div className="grid gap-3">
              {i.body}
              <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-[11rem_1fr]">
                <div className="grid gap-1.5">
                  <label htmlFor={`pts-${i.questionId}`} className="flex items-center gap-2 text-sm font-medium text-ink">
                    Điểm (tối đa {formatScore(i.max)})
                    {i.needsManual ? <Badge tone="orange">Chấm tay</Badge> : <Badge tone={i.isCorrect ? "success" : "neutral"}>Tự chấm</Badge>}
                  </label>
                  <Input
                    id={`pts-${i.questionId}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={i.max}
                    step={0.25}
                    value={points[i.questionId]}
                    onChange={(e) => setPoints((p) => ({ ...p, [i.questionId]: e.target.value }))}
                    aria-invalid={Number(points[i.questionId]) > i.max || undefined}
                  />
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setPoints((p) => ({ ...p, [i.questionId]: "0" }))}>
                      0
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setPoints((p) => ({ ...p, [i.questionId]: String(i.max / 2) }))}>
                      ½
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setPoints((p) => ({ ...p, [i.questionId]: String(i.max) }))}>
                      Tối đa
                    </Button>
                  </div>
                </div>
                <Field id={`c-${i.questionId}`} label="Nhận xét cho câu này">
                  <Textarea rows={2} value={comments[i.questionId] ?? ""} onChange={(e) => setComments((c) => ({ ...c, [i.questionId]: e.target.value }))} />
                </Field>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 rounded-lg border border-line bg-surface p-4 shadow-card">
        <p className="text-lg font-semibold text-ink">
          Tổng: {formatScore(earned)}/{formatScore(totalPoints)} điểm →{" "}
          <span className="text-blue-700 tabular-nums">
            {formatScore(scaled)}/{formatScore(maxScore)}
          </span>
        </p>
        {missing > 0 && <p className="text-sm text-warning">Còn {missing} câu chấm tay chưa nhập điểm (tính là 0).</p>}
        <Field id="overall" label="Nhận xét chung (học viên và phụ huynh xem được)">
          <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="VD: Con làm tốt phần từ vựng, cần luyện thêm thì hiện tại đơn." />
        </Field>
        <details className="text-sm">
          <summary className="cursor-pointer text-blue-700">Sửa tổng điểm thủ công</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field id="scoreOverride" label={`Tổng điểm (thang ${formatScore(maxScore)})`} error={errors.scoreOverride}>
              <Input type="number" inputMode="decimal" min={0} max={maxScore} step={0.25} value={override} onChange={(e) => setOverride(e.target.value)} />
            </Field>
            <Field id="reason" label="Lý do" error={errors.reason}>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: cộng điểm trình bày" />
            </Field>
          </div>
        </details>
        <label className="flex items-center gap-2 text-[15px]">
          <Checkbox checked={needsRevision} onChange={(e) => setNeedsRevision(e.target.checked)} />
          Yêu cầu làm lại (học viên được nộp lại, kể cả khi đã hết số lần làm)
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" loading={pending} onClick={() => save(false)}>
            {needsRevision ? "Gửi yêu cầu làm lại" : "Lưu điểm"}
          </Button>
          {nextHref && (
            <Button variant="outline" disabled={pending} onClick={() => save(true)}>
              Lưu & chấm bài tiếp theo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
