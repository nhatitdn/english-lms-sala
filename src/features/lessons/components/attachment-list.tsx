import { Download, ExternalLink, FileText, Image as ImageIcon, Link2, Music, PlaySquare, Video } from "lucide-react";
import type { MaterialType } from "@/generated/prisma/enums";
import { formatBytes } from "@/lib/format";
import { MATERIAL_TYPE_LABELS } from "@/lib/labels";
import { youtubeEmbedUrl, youtubeId } from "@/lib/youtube";

export type AttachmentView = {
  id: string;
  title: string;
  type: MaterialType;
  url: string | null;
  file: { id: string; originalName: string; mimeType: string; sizeBytes: bigint | number } | null;
};

const ICON = { DOCUMENT: FileText, AUDIO: Music, VIDEO: Video, IMAGE: ImageIcon, YOUTUBE: PlaySquare, LINK: Link2 } as const;

/** Renders lesson attachments: documents as links, media inline, YouTube embedded (privacy-enhanced). */
export function AttachmentList({ items }: { items: AttachmentView[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((m) => {
        const Icon = ICON[m.type];
        const fileUrl = m.file ? `/api/files/${m.file.id}` : null;
        const yt = m.type === "YOUTUBE" && m.url ? youtubeId(m.url) : null;
        return (
          <li key={m.id} className="overflow-hidden rounded-md border border-line bg-surface">
            <div className="flex items-center gap-3 p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-sky-100 text-blue-700">
                <Icon className="size-5" />
              </span>
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-medium text-ink">{m.title}</span>
                <span className="truncate text-xs text-ink-muted">
                  {MATERIAL_TYPE_LABELS[m.type]}
                  {m.file && ` · ${m.file.originalName} · ${formatBytes(Number(m.file.sizeBytes))}`}
                </span>
              </span>
              {fileUrl && (m.type === "DOCUMENT" || m.type === "IMAGE") && (
                <span className="flex shrink-0 gap-1">
                  <a href={fileUrl} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-blue-700 hover:bg-sky-50">
                    <ExternalLink className="size-4" /> Mở
                  </a>
                  <a href={`${fileUrl}?download=1`} className="grid size-10 place-items-center rounded-md text-ink-muted hover:bg-sky-50" aria-label={`Tải về ${m.title}`}>
                    <Download className="size-4" />
                  </a>
                </span>
              )}
              {m.type === "LINK" && m.url && (
                <a href={m.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-blue-700 hover:bg-sky-50">
                  <ExternalLink className="size-4" /> Mở link
                </a>
              )}
            </div>
            {fileUrl && m.type === "AUDIO" && (
              <div className="px-3 pb-3">
                <audio controls preload="none" src={fileUrl} className="w-full" />
              </div>
            )}
            {fileUrl && m.type === "VIDEO" && (
              <video controls preload="metadata" playsInline src={fileUrl} className="aspect-video w-full bg-ink" />
            )}
            {yt && (
              <div className="aspect-video w-full bg-ink">
                <iframe
                  src={youtubeEmbedUrl(yt)}
                  title={m.title}
                  loading="lazy"
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="size-full"
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
