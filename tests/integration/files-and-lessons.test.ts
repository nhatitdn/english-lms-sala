import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { saveAudioProgress } from "@/features/audio/progress";
import { createLesson, setLessonClasses, setLessonStatus, updateLesson, upsertAudioLesson, attachUploadedFile } from "@/features/lessons/service";
import { sanitizeRichText } from "@/features/rich-text/sanitize";
import { canAccessFile, canViewLesson } from "@/server/authz/policies";
import { db } from "@/server/db";
import { absolutePath, storeUpload } from "@/server/storage/store";
import { asCurrent, makeClass, makeUser } from "../support/factories";

const fixture = (name: string) => readFileSync(join(process.cwd(), "tests/fixtures", name));
const upload = (name: string, purpose: "material" | "audio" | "lesson-image" | "audio-cover", userId: string, as = name) =>
  storeUpload({ body: Readable.from([fixture(name)]), originalName: as, purpose, uploadedBy: userId });

describe("upload pipeline", () => {
  it("accepts a real PDF and MP3 and stores them under random names outside the web root", async () => {
    const t = await makeUser("TEACHER");
    const pdf = await upload("sample.pdf", "material", t.id, "Bài 3 — Từ vựng.pdf");
    const mp3 = await upload("sample.mp3", "audio", t.id);
    expect(pdf).toMatchObject({ kind: "DOCUMENT", mimeType: "application/pdf", originalName: "Bài 3 — Từ vựng.pdf" });
    expect(mp3).toMatchObject({ kind: "AUDIO", mimeType: "audio/mpeg" });
    const row = await db.file.findUniqueOrThrow({ where: { id: pdf.id } });
    expect(row.storageKey).toMatch(/^private\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
    expect(row.storageKey).not.toContain("Từ vựng");
    expect(readFileSync(absolutePath(row.storageKey)).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("rejects an executable renamed to .mp3 and HTML renamed to .pdf", async () => {
    const t = await makeUser("TEACHER");
    await expect(upload("fake-audio.mp3", "audio", t.id)).rejects.toMatchObject({ message: expect.stringMatching(/không đúng định dạng/) });
    await expect(upload("fake.pdf", "material", t.id)).rejects.toMatchObject({ message: expect.stringMatching(/không đúng định dạng/) });
    expect(await db.file.count()).toBe(0);
  });

  it("rejects disallowed extensions and files over the configured limit", async () => {
    const t = await makeUser("TEACHER");
    await expect(upload("sample.pdf", "material", t.id, "virus.exe")).rejects.toMatchObject({ message: expect.stringMatching(/không được phép/) });
    await expect(upload("sample.pdf", "audio", t.id)).rejects.toMatchObject({ message: expect.stringMatching(/không được phép/) }); // wrong purpose
    await db.systemSetting.create({ data: { key: "upload.limits", value: { audioMb: 0.01 } } }); // ≈10 KB
    await expect(upload("sample.mp3", "audio", t.id)).rejects.toMatchObject({ message: expect.stringMatching(/File quá lớn/) });
  });

  it("re-encodes photos and removes EXIF/GPS metadata (child privacy)", async () => {
    const t = await makeUser("TEACHER");
    expect((await sharp(fixture("with-gps.jpg")).metadata()).exif).toBeDefined();
    const img = await upload("with-gps.jpg", "lesson-image", t.id);
    const row = await db.file.findUniqueOrThrow({ where: { id: img.id } });
    expect(row.mimeType).toBe("image/webp");
    const meta = await sharp(absolutePath(row.storageKey)).metadata();
    expect(meta.exif).toBeUndefined();
    expect([meta.width, meta.height]).toEqual([64, 48]);
  });
});

describe("rich text sanitising", () => {
  it("drops unknown nodes and dangerous links, keeps safe formatting and image file ids", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const { doc, fileIds } = sanitizeRichText({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello", marks: [{ type: "bold" }, { type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
        { type: "script", content: [{ type: "text", text: "alert(1)" }] },
        { type: "image", attrs: { fileId: id, src: "https://evil.example/x.png", onerror: "alert(1)" } },
        { type: "paragraph", attrs: { style: "color:red" }, content: [{ type: "text", text: "ok", marks: [{ type: "link", attrs: { href: "https://example.com" } }] }] },
      ],
    });
    const json = JSON.stringify(doc);
    expect(json).not.toContain("javascript:");
    expect(json).not.toContain("script");
    expect(json).not.toContain("evil.example");
    expect(json).not.toContain("onerror");
    expect(json).not.toContain("style");
    expect(json).toContain("https://example.com");
    expect(fileIds).toEqual([id]);
  });
});

async function lessonWorld() {
  const teacher = await makeUser("TEACHER");
  const otherTeacher = await makeUser("TEACHER");
  const kid = await makeUser("STUDENT");
  const outsider = await makeUser("STUDENT");
  const parent = await makeUser("PARENT");
  const cls = await makeClass({ teacherIds: [teacher.teacher!.id], studentIds: [kid.student!.id] });
  await makeClass({ studentIds: [outsider.student!.id] });
  await db.parentStudent.create({ data: { parentId: parent.parent!.id, studentId: kid.student!.id } });
  const t = asCurrent(teacher);
  const lesson = await createLesson(t, { title: "Unit 3", skill: "LISTENING", classId: cls.id });
  return { teacher, t, otherTeacher, kid, outsider, parent, cls, lesson };
}

describe("lesson visibility and file access", () => {
  it("students only see published lessons of their own class, after the scheduled time", async () => {
    const w = await lessonWorld();
    expect(await canViewLesson(asCurrent(w.kid), w.lesson.id)).toBe(false); // draft
    await setLessonStatus(w.t, w.lesson.id, "PUBLISHED");
    expect(await canViewLesson(asCurrent(w.kid), w.lesson.id)).toBe(true);
    expect(await canViewLesson(asCurrent(w.outsider), w.lesson.id)).toBe(false); // student → other class
    expect(await canViewLesson(asCurrent(w.parent), w.lesson.id)).toBe(false);
    await setLessonClasses(w.t, w.lesson.id, [w.cls.id], new Date(Date.now() + 86_400_000).toISOString());
    expect(await canViewLesson(asCurrent(w.kid), w.lesson.id)).toBe(false); // not yet visible
  });

  it("files are reachable only through something the user may see (guessing /api/files/:id fails)", async () => {
    const w = await lessonWorld();
    const pdf = await upload("sample.pdf", "material", w.teacher.id);
    const img = await upload("with-gps.jpg", "lesson-image", w.teacher.id);
    const stray = await upload("sample.pdf", "material", w.teacher.id); // uploaded but never attached
    await attachUploadedFile(w.t, w.lesson.id, pdf.id);
    await updateLesson(w.t, {
      id: w.lesson.id,
      title: "Unit 3",
      skill: "LISTENING",
      tags: [],
      content: { type: "doc", content: [{ type: "image", attrs: { fileId: img.id } }] },
    });
    await setLessonStatus(w.t, w.lesson.id, "PUBLISHED");

    const kid = asCurrent(w.kid);
    expect(await canAccessFile(kid, pdf.id)).not.toBeNull();
    expect(await canAccessFile(kid, img.id)).not.toBeNull();
    expect(await canAccessFile(kid, stray.id)).toBeNull();
    expect(await canAccessFile(asCurrent(w.outsider), pdf.id)).toBeNull();
    expect(await canAccessFile(asCurrent(w.parent), pdf.id)).toBeNull();
    // other teachers can use shared library material
    expect(await canAccessFile(asCurrent(w.otherTeacher), pdf.id)).not.toBeNull();
    // unpublishing removes student access again
    await setLessonStatus(w.t, w.lesson.id, "DRAFT");
    expect(await canAccessFile(kid, pdf.id)).toBeNull();
  });

  it("only the author edits a lesson; another teacher's embedded images are not accepted", async () => {
    const w = await lessonWorld();
    await expect(updateLesson(asCurrent(w.otherTeacher), { id: w.lesson.id, title: "Hack", skill: "GENERAL", tags: [], content: null })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const foreign = await upload("with-gps.jpg", "lesson-image", w.otherTeacher.id);
    await updateLesson(w.t, { id: w.lesson.id, title: "Unit 3", skill: "GENERAL", tags: [], content: { type: "doc", content: [{ type: "image", attrs: { fileId: foreign.id } }] } });
    expect((await db.lesson.findUniqueOrThrow({ where: { id: w.lesson.id } })).contentFileIds).toEqual([]);
  });
});

describe("listening progress", () => {
  it("remembers position and marks complete at the threshold; non-members cannot report", async () => {
    const w = await lessonWorld();
    const mp3 = await upload("sample.mp3", "audio", w.teacher.id);
    const audio = await upsertAudioLesson(w.t, { lessonId: w.lesson.id, title: "At the zoo", audioFileId: mp3.id, transcriptMode: "AFTER_COMPLETE", completeThreshold: 80 });
    await setLessonStatus(w.t, w.lesson.id, "PUBLISHED");
    const kid = asCurrent(w.kid);

    const r1 = await saveAudioProgress(kid, { audioLessonId: audio.id, positionSec: 3, listenedDeltaSec: 3, durationSec: 6, started: true });
    expect(r1).toMatchObject({ ok: true, progress: { positionSec: 3, listenedSec: 3, completedAt: null, playCount: 1 } });
    const r2 = await saveAudioProgress(kid, { audioLessonId: audio.id, positionSec: 5, listenedDeltaSec: 2, durationSec: 6 });
    expect(r2.ok && r2.progress.completedAt).toBeTruthy(); // 5/6 s ≥ 80 %
    expect((await db.file.findUniqueOrThrow({ where: { id: mp3.id } })).durationSec).toBe(6);

    expect(await saveAudioProgress(asCurrent(w.outsider), { audioLessonId: audio.id, positionSec: 1, listenedDeltaSec: 1 })).toEqual({ ok: false, status: 404 });
    expect(await saveAudioProgress(w.t, { audioLessonId: audio.id, positionSec: 1, listenedDeltaSec: 1 })).toEqual({ ok: false, status: 403 });
  });
});
