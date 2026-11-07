"use client";

import { Link2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FilePicker } from "@/components/uploader/file-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { SKILL_LABELS } from "@/lib/labels";
import type { ActionResult } from "@/server/action";
import { createLinkMaterialAction, createMaterialFromFileAction, deleteMaterialAction, updateMaterialAction } from "../actions";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error.message);
      if (r.message) toast.success(r.message);
      onOk?.();
      router.refresh();
    });
  return { pending, run };
}

export function LibraryUpload() {
  const { run } = useRun();
  return <FilePicker purpose="material" multiple label="Tải tài liệu lên thư viện" onUploaded={(f) => run(() => createMaterialFromFileAction({ fileId: f.id }))} />;
}

export function AddLinkButton() {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Link2 /> Thêm link / YouTube
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm link vào thư viện</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3" action={(fd) => run(() => createLinkMaterialAction(fd), () => setOpen(false))}>
          <Field id="lib-url" label="Đường link" required>
            <Input name="url" type="url" placeholder="https://…" />
          </Field>
          <Field id="lib-title" label="Tiêu đề" required>
            <Input name="title" />
          </Field>
          <Field id="lib-skill" label="Phân loại">
            <NativeSelect name="skill" defaultValue="">
              <option value="">—</option>
              {Object.entries(SKILL_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="lib-tags" label="Chủ đề" hint="Cách nhau bằng dấu phẩy">
            <Input name="tags" />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="primary" loading={pending}>
              Thêm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MaterialRowActions({
  material,
}: {
  material: { id: string; title: string; description: string | null; skill: string | null; tags: string[]; sharedWithTeachers: boolean };
}) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState<"edit" | "delete" | null>(null);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen("edit")} aria-label={`Sửa ${material.title}`}>
        <Pencil />
      </Button>
      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setOpen("delete")} aria-label={`Xóa ${material.title}`}>
        <Trash2 />
      </Button>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          {open === "edit" ? (
            <>
              <DialogHeader>
                <DialogTitle>Sửa tài liệu</DialogTitle>
              </DialogHeader>
              <form
                className="grid gap-3"
                action={(fd) => {
                  fd.set("id", material.id);
                  run(() => updateMaterialAction(fd), () => setOpen(null));
                }}
              >
                <Field id="m-title" label="Tiêu đề" required>
                  <Input name="title" defaultValue={material.title} />
                </Field>
                <Field id="m-desc" label="Mô tả">
                  <Textarea name="description" defaultValue={material.description ?? ""} rows={2} />
                </Field>
                <Field id="m-skill" label="Phân loại">
                  <NativeSelect name="skill" defaultValue={material.skill ?? ""}>
                    <option value="">—</option>
                    {Object.entries(SKILL_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field id="m-tags" label="Chủ đề">
                  <Input name="tags" defaultValue={material.tags.join(", ")} />
                </Field>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <Checkbox name="sharedWithTeachers" defaultChecked={material.sharedWithTeachers} /> Chia sẻ với giáo viên khác
                </label>
                <DialogFooter>
                  <Button type="submit" variant="primary" loading={pending}>
                    Lưu
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Xóa “{material.title}”?</DialogTitle>
                <DialogDescription>Chỉ xóa được khi tài liệu không còn nằm trong bài giảng nào.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Hủy</Button>
                </DialogClose>
                <Button variant="destructive" loading={pending} onClick={() => run(() => deleteMaterialAction({ id: material.id }), () => setOpen(null))}>
                  Xóa
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
