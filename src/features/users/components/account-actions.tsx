"use client";

import { Ban, KeyRound, Lock, LockOpen } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { UserStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resetPasswordAction, setUserStatusAction } from "../actions";
import { TempPasswordDialog } from "./temp-password-dialog";

type Confirm = { kind: "reset" } | { kind: "status"; status: UserStatus };

export function AccountActions({ id, username, fullName, status, isSelf }: { id: string; username: string; fullName: string; status: UserStatus; isSelf: boolean }) {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (!confirm) return;
    startTransition(async () => {
      if (confirm.kind === "reset") {
        const r = await resetPasswordAction({ id });
        if (!r.ok) return void toast.error(r.error.message);
        setConfirm(null);
        setTempPassword(r.data.tempPassword);
      } else {
        const r = await setUserStatusAction({ id, status: confirm.status });
        if (!r.ok) return void toast.error(r.error.message);
        setConfirm(null);
        toast.success(r.message);
      }
    });
  }

  const copy =
    confirm?.kind === "reset"
      ? { title: "Cấp lại mật khẩu?", body: `${fullName} sẽ bị đăng xuất khỏi mọi thiết bị và phải đổi mật khẩu khi đăng nhập lại.`, cta: "Cấp mật khẩu tạm", danger: false }
      : confirm?.status === "LOCKED"
        ? { title: "Khóa tài khoản?", body: `${fullName} sẽ bị đăng xuất ngay và không đăng nhập được cho tới khi mở khóa. Dữ liệu học tập được giữ nguyên.`, cta: "Khóa tài khoản", danger: true }
        : confirm?.status === "DISABLED"
          ? { title: "Ngừng sử dụng tài khoản?", body: `Dùng khi ${fullName} đã nghỉ học/nghỉ dạy. Dữ liệu được giữ nguyên, có thể mở lại sau.`, cta: "Ngừng sử dụng", danger: true }
          : { title: "Mở khóa tài khoản?", body: `${fullName} có thể đăng nhập lại.`, cta: "Mở khóa", danger: false };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setConfirm({ kind: "reset" })}>
          <KeyRound /> Cấp lại mật khẩu
        </Button>
        {status === "ACTIVE" ? (
          !isSelf && (
            <>
              <Button variant="outline" onClick={() => setConfirm({ kind: "status", status: "LOCKED" })}>
                <Lock /> Khóa
              </Button>
              <Button variant="ghost" className="text-danger" onClick={() => setConfirm({ kind: "status", status: "DISABLED" })}>
                <Ban /> Ngừng sử dụng
              </Button>
            </>
          )
        ) : (
          <Button variant="outline" onClick={() => setConfirm({ kind: "status", status: "ACTIVE" })}>
            <LockOpen /> Mở lại tài khoản
          </Button>
        )}
      </div>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Hủy</Button>
            </DialogClose>
            <Button variant={copy.danger ? "destructive" : "primary"} loading={pending} onClick={run}>
              {copy.cta}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {tempPassword && (
        <TempPasswordDialog open onOpenChange={(o) => !o && setTempPassword(null)} username={username} password={tempPassword} title="Mật khẩu tạm mới" />
      )}
    </>
  );
}
