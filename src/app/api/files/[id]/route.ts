import { Readable } from "node:stream";
import { getCurrentUser } from "@/server/auth/current-user";
import { canAccessFile } from "@/server/authz/policies";
import { fileStat, openFileStream } from "@/server/storage/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INLINE_KINDS = new Set(["IMAGE", "AUDIO", "VIDEO"]);

function notFound() {
  return new Response("Không tìm thấy file.", { status: 404, headers: { "Cache-Control": "no-store" } });
}

/** RFC 5987 filename for Vietnamese names. */
function contentDisposition(type: "inline" | "attachment", name: string) {
  const ascii = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * Stream a file the user is allowed to see. Supports HTTP Range (needed for seeking audio/video,
 * especially on iOS Safari). In production behind Nginx, set FILE_SERVING=x-accel so Nginx streams
 * the bytes from an internal location after this handler has authorised the request.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const user = await getCurrentUser();
  if (!user) return notFound();
  const file = await canAccessFile(user, id);
  if (!file) return notFound();

  const download = new URL(request.url).searchParams.get("download") === "1";
  const inline = !download && (INLINE_KINDS.has(file.kind) || file.mimeType === "application/pdf");
  const headers = new Headers({
    "Content-Type": file.mimeType,
    "Content-Disposition": contentDisposition(inline ? "inline" : "attachment", file.originalName),
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  });
  // Uploaded files must never run as pages. (PDFs are exempt: the browser PDF viewer needs plugins.)
  if (file.mimeType !== "application/pdf") headers.set("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");

  if (process.env.FILE_SERVING === "x-accel") {
    headers.set("X-Accel-Redirect", `/_protected/${file.storageKey}`);
    return new Response(null, { status: 200, headers });
  }

  let size: number;
  try {
    size = (await fileStat(file.storageKey)).size;
  } catch {
    return notFound();
  }

  const range = request.headers.get("range");
  if (range) {
    const m = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!m || (m[1] === "" && m[2] === "")) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    let start: number;
    let end: number;
    if (m[1] === "") {
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    } else {
      start = Number(m[1]);
      end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(openFileStream(file.storageKey, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  const stream = Readable.toWeb(openFileStream(file.storageKey)) as ReadableStream;
  return new Response(stream, { status: 200, headers });
}
