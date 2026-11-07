"use client";

import type { UploadPurpose } from "@/server/storage/rules";

export type UploadedFile = { id: string; kind: "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO" | "RECORDING"; originalName: string; mimeType: string; sizeBytes: number };

/** Upload one file as a raw body with progress (XHR — fetch has no upload progress). */
export function uploadFile(file: File, purpose: UploadPurpose, onProgress?: (ratio: number) => void): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/uploads?purpose=${purpose}&name=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let body: { error?: { message?: string } } & Partial<UploadedFile> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as UploadedFile);
      else if (xhr.status === 413) reject(new Error(body.error?.message ?? "File quá lớn."));
      else reject(new Error(body.error?.message ?? "Tải lên thất bại. Vui lòng thử lại."));
    };
    xhr.onerror = () => reject(new Error("Mất kết nối khi tải lên. Vui lòng thử lại."));
    xhr.send(file);
  });
}
