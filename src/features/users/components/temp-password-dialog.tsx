"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/misc";

/** Shows a temporary password exactly once. */
export function TempPasswordDialog({
  open,
  onOpenChange,
  username,
  password,
  title = "Mật khẩu tạm",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  password: string;
  title?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const text = `Tên đăng nhập: ${username}\nMật khẩu tạm: ${password}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Gửi thông tin này cho người dùng. Lần đầu đăng nhập họ sẽ phải đổi mật khẩu.</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 rounded-md bg-sky-50 p-4 font-mono text-[15px]">
          <div className="flex justify-between gap-3">
            <dt className="font-sans text-ink-muted">Tên đăng nhập</dt>
            <dd className="font-semibold text-ink">{username}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-sans text-ink-muted">Mật khẩu tạm</dt>
            <dd className="font-semibold text-ink" data-testid="temp-password">
              {password}
            </dd>
          </div>
        </dl>
        <Alert tone="warning">Mật khẩu này chỉ hiển thị một lần. Hãy sao chép trước khi đóng.</Alert>
        <DialogFooter>
          {children}
          <Button
            variant="primary"
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? "Đã sao chép" : "Sao chép"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
