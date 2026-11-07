"use client";

import { Mic, RotateCcw, Square, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/uploader/file-picker";
import { uploadFile } from "@/components/uploader/upload-file";

/** Pick a format the browser can record: WebM/Opus on Chrome & Android, MP4/AAC on iPhone Safari. */
function pickMime(): { mime: string; ext: string } | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  const candidates = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported?.(c.mime)) ?? { mime: "", ext: "webm" };
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Speaking answer: record → listen back → upload. The recording is only kept once uploaded;
 * the student can re-record as many times as they like before submitting.
 */
export function Recorder({ fileId, maxDurationSec, onChange, label }: { fileId: string | null; maxDurationSec: number; onChange: (fileId: string | null) => void; label: string }) {
  const [state, setState] = useState<"idle" | "recording" | "review" | "uploading">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<{ url: string; blob: Blob; ext: string } | null>(null);
  const [supported, setSupported] = useState(true);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    // capability check must run in the browser only
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!navigator.mediaDevices?.getUserMedia && pickMime() !== null);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      rec.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    const fmtInfo = pickMime();
    if (!fmtInfo) return setSupported(false);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      toast.error("Không mở được micro. Hãy cho phép trình duyệt dùng micro (biểu tượng ổ khóa cạnh địa chỉ web) rồi thử lại.");
      return;
    }
    const r = new MediaRecorder(stream, fmtInfo.mime ? { mimeType: fmtInfo.mime } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) window.clearInterval(timer.current);
      const type = r.mimeType || fmtInfo.mime || "audio/webm";
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const blob = new Blob(chunks, { type });
      setPreview({ url: URL.createObjectURL(blob), blob, ext });
      setState("review");
    };
    rec.current = r;
    r.start(1000);
    setElapsed(0);
    setState("recording");
    const started = Date.now();
    timer.current = window.setInterval(() => {
      const s = (Date.now() - started) / 1000;
      setElapsed(s);
      if (s >= maxDurationSec && r.state === "recording") r.stop();
    }, 250);
  }

  async function use() {
    if (!preview) return;
    setState("uploading");
    try {
      const file = new File([preview.blob], `ghi-am.${preview.ext}`, { type: preview.blob.type });
      const up = await uploadFile(file, "recording");
      onChange(up.id);
      URL.revokeObjectURL(preview.url);
      setPreview(null);
      setState("idle");
      toast.success("Đã lưu bản ghi âm.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tải bản ghi thất bại. Thử lại nhé.");
      setState("review");
    }
  }

  return (
    <div className="grid gap-3" aria-label={label}>
      {fileId && state === "idle" && (
        <div className="grid gap-2 rounded-md border border-success/30 bg-success/5 p-3">
          <p className="text-sm font-medium text-success">Bản ghi đã lưu</p>
          <audio controls preload="metadata" src={`/api/files/${fileId}`} className="w-full" />
          <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => onChange(null)}>
            <RotateCcw /> Xóa và ghi lại
          </Button>
        </div>
      )}

      {!fileId && state === "idle" && supported && (
        <Button type="button" variant="primary" size="lg" onClick={start} className="justify-self-start">
          <Mic /> Bắt đầu ghi âm
        </Button>
      )}

      {state === "recording" && (
        <div className="flex items-center gap-3 rounded-md border border-danger/30 bg-danger/5 p-3" role="status">
          <span className="size-3 animate-pulse rounded-full bg-danger" aria-hidden />
          <span className="font-medium text-ink tabular-nums">
            Đang ghi {fmt(elapsed)} / {fmt(maxDurationSec)}
          </span>
          <Button type="button" variant="destructive" className="ml-auto" onClick={() => rec.current?.stop()}>
            <Square /> Dừng
          </Button>
        </div>
      )}

      {(state === "review" || state === "uploading") && preview && (
        <div className="grid gap-2 rounded-md border border-line p-3">
          <p className="text-sm text-ink-muted">Nghe lại bản ghi ({fmt(elapsed)}):</p>
          <audio controls src={preview.url} className="w-full" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" loading={state === "uploading"} onClick={use}>
              <Upload /> Dùng bản ghi này
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={state === "uploading"}
              onClick={() => {
                URL.revokeObjectURL(preview.url);
                setPreview(null);
                setState("idle");
              }}
            >
              <RotateCcw /> Ghi lại
            </Button>
          </div>
        </div>
      )}

      {!fileId && state === "idle" && (
        <details className="text-sm">
          <summary className="cursor-pointer text-blue-700">{supported ? "Hoặc gửi file ghi âm có sẵn" : "Trình duyệt này không ghi âm được — gửi file ghi âm từ điện thoại"}</summary>
          <FilePicker purpose="recording" className="mt-2" label="Chọn file ghi âm (m4a, mp3, webm…)" onUploaded={(f) => onChange(f.id)} />
        </details>
      )}
    </div>
  );
}
