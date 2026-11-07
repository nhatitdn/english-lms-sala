"use client";

import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { acceptFor, FILE_RULES, PURPOSE_KINDS, type UploadPurpose } from "@/server/storage/rules";
import { cn } from "@/lib/utils";
import { uploadFile, type UploadedFile } from "./upload-file";

/** Tap-or-drop uploader with progress. Calls onUploaded for each finished file. */
export function FilePicker({
  purpose,
  multiple = false,
  onUploaded,
  label = "Chọn file hoặc kéo thả vào đây",
  className,
}: {
  purpose: UploadPurpose;
  multiple?: boolean;
  onUploaded: (file: UploadedFile) => void | Promise<void>;
  label?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<{ name: string; progress: number }[]>([]);
  const [drag, setDrag] = useState(false);
  const hint = PURPOSE_KINDS[purpose].map((k) => FILE_RULES[k].label).join(" · ");

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    const list = multiple ? [...files] : [files[0]!];
    for (const file of list) {
      setJobs((j) => [...j, { name: file.name, progress: 0 }]);
      try {
        const uploaded = await uploadFile(file, purpose, (p) => setJobs((j) => j.map((x) => (x.name === file.name ? { ...x, progress: p } : x))));
        await onUploaded(uploaded);
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "Tải lên thất bại."}`);
      } finally {
        setJobs((j) => j.filter((x) => x.name !== file.name));
      }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors",
          drag ? "border-blue-600 bg-sky-100/60" : "border-line bg-surface hover:bg-sky-50",
        )}
      >
        <UploadCloud className="size-6 text-blue-600" aria-hidden />
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-xs text-ink-muted">{hint}</span>
      </button>
      <input ref={input} type="file" hidden multiple={multiple} accept={acceptFor(purpose)} onChange={(e) => void handle(e.target.files)} data-testid={`file-input-${purpose}`} />
      {jobs.length > 0 && (
        <ul className="mt-2 grid gap-2" aria-live="polite">
          {jobs.map((j) => (
            <li key={j.name} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate text-ink">{j.name}</span>
                <span className="text-ink-muted tabular-nums">{Math.round(j.progress * 100)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sky-100">
                <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${j.progress * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
