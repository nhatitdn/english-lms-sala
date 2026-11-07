import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import type { FileKind } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { getSetting } from "@/server/settings";
import { FILE_RULES, PURPOSE_KINDS, extensionOf, kindForExtension, sanitizeFileName, type UploadPurpose } from "./rules";

const MB = 1024 * 1024;

export function uploadRoot(): string {
  return resolve(process.env.UPLOAD_DIR ?? "./data/uploads");
}

/** Resolve a storage key to an absolute path, refusing anything that escapes the upload root. */
export function absolutePath(storageKey: string): string {
  const root = uploadRoot();
  const full = resolve(root, storageKey);
  if (!full.startsWith(root + sep)) throw new Error("Invalid storage key");
  return full;
}

export type StoredFile = { id: string; kind: FileKind; originalName: string; mimeType: string; sizeBytes: number; width: number | null; height: number | null };

class LimitStream extends Transform {
  bytes = 0;
  hash = createHash("sha256");
  constructor(private readonly max: number) {
    super();
  }
  _transform(chunk: Buffer, _enc: BufferEncoding, cb: (err?: Error | null, data?: Buffer) => void) {
    this.bytes += chunk.length;
    if (this.bytes > this.max) return cb(new AppError("VALIDATION_ERROR", "FILE_TOO_LARGE"));
    this.hash.update(chunk);
    cb(null, chunk);
  }
}

/**
 * The single upload pipeline (ARCHITECTURE §5):
 * size limit while streaming → extension allow-list → real type from magic bytes → images re-encoded
 * (EXIF/GPS removed) → random name outside the web root → `files` row. Never returns a path.
 */
export async function storeUpload(params: {
  body: ReadableStream<Uint8Array> | Readable;
  originalName: string;
  purpose: UploadPurpose;
  uploadedBy: string;
  declaredSize?: number;
}): Promise<StoredFile> {
  const originalName = sanitizeFileName(params.originalName);
  const ext = extensionOf(originalName);
  const kind = kindForExtension(ext);
  const allowed = PURPOSE_KINDS[params.purpose] as readonly string[];
  if (!kind || !allowed.includes(kind)) {
    throw new AppError("VALIDATION_ERROR", `Loại file .${ext || "?"} không được phép ở đây.`);
  }
  const rule = FILE_RULES[kind];
  const limits = await getSetting("upload.limits");
  const maxBytes = limits[rule.limitKey] * MB;
  if (params.declaredSize && params.declaredSize > maxBytes) {
    throw new AppError("VALIDATION_ERROR", `File quá lớn. Tối đa ${limits[rule.limitKey]} MB.`);
  }

  const root = uploadRoot();
  const tmpDir = join(root, "tmp");
  await mkdir(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, randomUUID());
  const limiter = new LimitStream(maxBytes);
  try {
    const source = params.body instanceof Readable ? params.body : Readable.fromWeb(params.body as import("node:stream/web").ReadableStream);
    await pipeline(source, limiter, createWriteStream(tmpPath, { mode: 0o640 }));
  } catch (e) {
    await rm(tmpPath, { force: true });
    if (e instanceof AppError && e.message === "FILE_TOO_LARGE") throw new AppError("VALIDATION_ERROR", `File quá lớn. Tối đa ${limits[rule.limitKey]} MB.`);
    throw e;
  }
  if (limiter.bytes === 0) {
    await rm(tmpPath, { force: true });
    throw new AppError("VALIDATION_ERROR", "File rỗng.");
  }

  try {
    // Real type from the first bytes — never trust the browser's Content-Type
    const head = Buffer.alloc(4100);
    const fh = await open(tmpPath, "r");
    const { bytesRead } = await fh.read(head, 0, head.length, 0);
    await fh.close();
    const detected = await fileTypeFromBuffer(head.subarray(0, bytesRead));
    if (!detected || !rule.mimes.includes(detected.mime)) {
      throw new AppError("VALIDATION_ERROR", `Nội dung file không đúng định dạng .${ext}. File có thể bị đổi đuôi hoặc bị hỏng.`);
    }

    const now = new Date();
    const folder = `private/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const id = randomUUID();
    let finalExt = ext;
    let mimeType = detected.mime;
    let width: number | null = null;
    let height: number | null = null;
    let sizeBytes = limiter.bytes;
    let sha256 = limiter.hash.digest("hex");
    let storageKey: string;

    if (kind === "IMAGE") {
      // Re-encode: applies EXIF orientation, then drops ALL metadata (GPS, camera, …) — child privacy.
      finalExt = "webp";
      mimeType = "image/webp";
      storageKey = `${folder}/${id}.webp`;
      const dest = absolutePath(storageKey);
      await mkdir(dirname(dest), { recursive: true });
      const info = await sharp(tmpPath, { failOn: "error" })
        .rotate()
        .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(dest);
      width = info.width;
      height = info.height;
      sizeBytes = info.size;
      sha256 = createHash("sha256").update(await sharp(dest).toBuffer()).digest("hex");
      await rm(tmpPath, { force: true });
    } else {
      storageKey = `${folder}/${id}.${ext}`;
      const dest = absolutePath(storageKey);
      await mkdir(dirname(dest), { recursive: true });
      await rename(tmpPath, dest);
    }

    const row = await db.file.create({
      data: {
        id,
        storageKey,
        kind,
        originalName: finalExt === ext ? originalName : originalName.replace(/\.[^.]+$/, `.${finalExt}`),
        mimeType,
        extension: finalExt,
        sizeBytes: BigInt(sizeBytes),
        sha256,
        width,
        height,
        uploadedBy: params.uploadedBy,
      },
      select: { id: true, kind: true, originalName: true, mimeType: true, sizeBytes: true, width: true, height: true },
    });
    return { ...row, sizeBytes: Number(row.sizeBytes) };
  } catch (e) {
    await rm(tmpPath, { force: true });
    if (e instanceof AppError) throw e;
    console.error("[upload] failed", e);
    throw new AppError("VALIDATION_ERROR", "Không xử lý được file. File có thể bị hỏng.");
  }
}

export async function fileStat(storageKey: string) {
  return stat(absolutePath(storageKey));
}

export function openFileStream(storageKey: string, range?: { start: number; end: number }) {
  return createReadStream(absolutePath(storageKey), range);
}
