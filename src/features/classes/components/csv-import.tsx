"use client";

import { Download, FileUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { importStudentsAction } from "../actions";
import { useRunAction } from "./use-action";

type Row = { line: number; fullName: string; username: string; tempPassword?: string; error?: string };

export function CsvImport({ classId }: { classId: string }) {
  const { pending, run } = useRunAction();
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);

  function download() {
    const lines = ["Họ tên,Tên đăng nhập,Mật khẩu tạm,Ghi chú", ...(rows ?? []).map((r) => [r.fullName, r.username, r.tempPassword ?? "", r.error ?? ""].map((v) => `"${v.replace(/"/g, '""')}"`).join(","))];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tai-khoan-hoc-vien.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Dialog onOpenChange={(o) => !o && (setRows(null), setCsv(""))}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp /> Nhập danh sách
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nhập học viên từ danh sách</DialogTitle>
          <DialogDescription>
            Dán từ Excel/Google Sheets, mỗi dòng một học viên: <strong>Họ tên, Ngày sinh (dd/mm/yyyy), SĐT, Tên đăng nhập</strong>. Chỉ cần cột Họ tên; tên đăng nhập trống sẽ được tự tạo.
          </DialogDescription>
        </DialogHeader>
        {!rows ? (
          <>
            <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} placeholder={"Nguyễn Minh Anh, 12/03/2016, 0905123456\nPhạm Quốc Bảo, 02/08/2014"} className="font-mono text-sm" aria-label="Danh sách học viên" />
            <Button variant="primary" disabled={!csv.trim()} loading={pending} onClick={() => run(() => importStudentsAction({ classId, csv }), (data) => setRows(data))}>
              Tạo tài khoản và thêm vào lớp
            </Button>
          </>
        ) : (
          <>
            <Alert tone="warning">Mật khẩu tạm chỉ hiển thị lúc này. Hãy tải file về trước khi đóng.</Alert>
            <div className="max-h-72 overflow-auto rounded-md border border-line">
              <table className="w-full text-sm">
                <thead className="bg-sky-50 text-left text-xs text-ink-muted uppercase">
                  <tr>
                    <th className="px-3 py-2">Họ tên</th>
                    <th className="px-3 py-2">Tên đăng nhập</th>
                    <th className="px-3 py-2">Mật khẩu tạm / lỗi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.line} className="border-t border-line">
                      <td className="px-3 py-2">{r.fullName}</td>
                      <td className="px-3 py-2 font-mono">{r.username}</td>
                      <td className={`px-3 py-2 ${r.error ? "text-danger" : "font-mono"}`}>{r.error ?? r.tempPassword}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="primary" onClick={download}>
              <Download /> Tải danh sách tài khoản (CSV)
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
