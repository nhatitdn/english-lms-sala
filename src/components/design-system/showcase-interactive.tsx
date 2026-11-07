"use client";

import { toast } from "sonner";
import { ErrorState } from "@/components/design-system/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Mở modal</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Giao bài cho cả lớp?</DialogTitle>
          <DialogDescription>Học viên sẽ nhận được thông báo ngay. Trên điện thoại, modal hiện dạng tấm trượt từ dưới lên.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Hủy</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="primary">Giao bài</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast.success("Đã lưu bài giảng.")}>
        Toast thành công
      </Button>
      <Button variant="outline" onClick={() => toast.error("Không tải được file. Vui lòng thử lại.")}>
        Toast lỗi
      </Button>
      <Button variant="outline" onClick={() => toast("Bài làm đã được lưu trên máy.", { description: "Sẽ đồng bộ khi có mạng." })}>
        Toast thông tin
      </Button>
    </div>
  );
}

export function ErrorStateDemo() {
  return <ErrorState onRetry={() => toast("Đang thử lại…")} />;
}
