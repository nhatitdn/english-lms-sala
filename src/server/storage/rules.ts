// Shared by server and client (upload widgets show the same rules). No server-only marker.
import type { FileKind } from "@/generated/prisma/enums";
import type { UploadLimits } from "@/server/settings-defaults";

type Rule = { exts: string[]; mimes: string[]; limitKey: keyof UploadLimits; label: string };

/**
 * Allow-list of uploadable files. The extension AND the real type detected from the file's bytes
 * must both be in the same rule. Anything else is rejected.
 */
export const FILE_RULES: Record<FileKind, Rule> = {
  IMAGE: { exts: ["jpg", "jpeg", "png", "webp"], mimes: ["image/jpeg", "image/png", "image/webp"], limitKey: "imageMb", label: "Ảnh (JPG, PNG, WEBP)" },
  DOCUMENT: {
    exts: ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"],
    mimes: [
      "application/pdf",
      "application/x-cfb", // legacy .doc/.ppt/.xls container
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    limitKey: "documentMb",
    label: "Tài liệu (PDF, Word, PowerPoint, Excel)",
  },
  AUDIO: {
    exts: ["mp3", "m4a", "wav", "ogg"],
    mimes: ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/vnd.wave", "audio/ogg", "audio/opus"],
    limitKey: "audioMb",
    label: "Âm thanh (MP3, M4A, WAV, OGG)",
  },
  VIDEO: { exts: ["mp4", "webm", "mov"], mimes: ["video/mp4", "video/webm", "video/quicktime"], limitKey: "videoMb", label: "Video (MP4, WEBM, MOV)" },
  /**
   * Speaking answers recorded in the browser. Chrome/Android produce WebM (Opus), iOS Safari produces
   * MP4/M4A (AAC) — magic-byte detection reports these as video/* containers, so both are accepted.
   * Only reachable through the "recording" purpose (extensions overlap with AUDIO/VIDEO).
   */
  RECORDING: {
    exts: ["webm", "ogg", "m4a", "mp4", "mp3"],
    mimes: ["audio/webm", "video/webm", "audio/ogg", "audio/opus", "audio/mp4", "audio/x-m4a", "video/mp4", "audio/mpeg", "audio/aac"],
    limitKey: "audioMb",
    label: "Bản ghi âm",
  },
};

/** Which kinds each upload purpose accepts. */
export const PURPOSE_KINDS = {
  material: ["DOCUMENT", "AUDIO", "VIDEO", "IMAGE"],
  "lesson-image": ["IMAGE"],
  audio: ["AUDIO"],
  "audio-cover": ["IMAGE"],
  // Phase 3 — assignments
  "question-media": ["IMAGE", "AUDIO"],
  "submission-file": ["IMAGE", "DOCUMENT"],
  "submission-image": ["IMAGE"],
  recording: ["RECORDING"],
} as const satisfies Record<string, readonly FileKind[]>;

/** Purposes students may upload for (everything else is staff-only). */
export const STUDENT_PURPOSES: readonly UploadPurpose[] = ["submission-file", "submission-image", "recording"];
export type UploadPurpose = keyof typeof PURPOSE_KINDS;

export function extensionOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return m ? m[1]! : "";
}

export function kindForExtension(ext: string, purpose?: UploadPurpose): FileKind | null {
  if (purpose === "recording") return FILE_RULES.RECORDING.exts.includes(ext) ? "RECORDING" : null;
  for (const [kind, rule] of Object.entries(FILE_RULES)) if (kind !== "RECORDING" && rule.exts.includes(ext)) return kind as FileKind;
  return null;
}

/** Accept attribute for <input type="file">. */
export function acceptFor(purpose: UploadPurpose): string {
  return PURPOSE_KINDS[purpose].flatMap((k) => FILE_RULES[k].exts.map((e) => `.${e}`)).join(",");
}

/** Strip path parts and control characters; keep the readable name for downloads. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "").trim().slice(0, 150);
  return cleaned || "file";
}
