"use client";

import { Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { archiveClassAction } from "../actions";

export function ArchiveClassButton({ classId, name }: { classId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-danger">
          <Archive /> Lưu trữ lớp
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lưu trữ lớp {name}?</DialogTitle>
          <DialogDescription>Lớp sẽ ẩn khỏi danh sách. Toàn bộ thành viên, bài nộp, điểm và điểm danh được giữ nguyên trong database.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Hủy</Button>
          </DialogClose>
          <Button
            variant="destructive"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await archiveClassAction({ classId });
                if (!r.ok) return void toast.error(r.error.message);
                toast.success(r.message);
                router.push("/app/classes");
              })
            }
          >
            Lưu trữ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
