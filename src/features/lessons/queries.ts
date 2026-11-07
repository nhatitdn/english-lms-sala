import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/server/auth/current-user";
import { assignedToStudentWhere, canEditLesson, canManageClass, canViewClass, visibleLessonWhere } from "@/server/authz/policies";
import { db } from "@/server/db";

const attachmentSelect = {
  id: true,
  sortOrder: true,
  material: {
    select: {
      id: true,
      title: true,
      type: true,
      url: true,
      file: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
    },
  },
} satisfies Prisma.LessonAttachmentSelect;

/** Staff lesson list (/app/lessons). */
export async function listLessonsForStaff(user: CurrentUser, opts: { q?: string; skill?: string; scope: "mine" | "all" }) {
  const where: Prisma.LessonWhereInput = {
    AND: [
      visibleLessonWhere(user),
      opts.scope === "mine" ? { authorId: user.id } : {},
      opts.skill ? { skill: opts.skill as Prisma.LessonWhereInput["skill"] } : {},
      opts.q ? { OR: [{ title: { contains: opts.q, mode: "insensitive" } }, { tags: { has: opts.q.toLowerCase() } }] } : {},
    ],
  };
  return db.lesson.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      skill: true,
      status: true,
      updatedAt: true,
      author: { select: { id: true, fullName: true } },
      classes: { select: { class: { select: { code: true } } } },
      _count: { select: { attachments: true, audioLessons: true } },
    },
  });
}

/** Lessons shown in a class tab. Students only see published + already visible ones (via visibleLessonWhere). */
export async function lessonsForClass(user: CurrentUser, classId: string) {
  if (!(await canViewClass(user, classId)) || user.role === "PARENT") return [];
  const manager = await canManageClass(user, classId);
  const where: Prisma.LessonWhereInput = manager
    ? { deletedAt: null, classes: { some: { classId } } }
    : { AND: [visibleLessonWhere(user), { classes: { some: { classId } } }] };
  return db.lesson.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      skill: true,
      status: true,
      publishedAt: true,
      classes: { where: { classId }, select: { visibleFrom: true } },
      _count: { select: { attachments: true, audioLessons: true } },
    },
  });
}

export async function getLessonDetail(user: CurrentUser, lessonId: string) {
  const lesson = await db.lesson.findFirst({
    where: { AND: [{ id: lessonId }, visibleLessonWhere(user)] },
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      skill: true,
      tags: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      copiedFromId: true,
      author: { select: { id: true, fullName: true } },
      classes: { select: { classId: true, visibleFrom: true, class: { select: { id: true, code: true, name: true } } } },
      attachments: { orderBy: { sortOrder: "asc" }, select: attachmentSelect },
      audioLessons: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          instructions: true,
          transcript: true,
          transcriptMode: true,
          completeThreshold: true,
          audioFileId: true,
          coverFileId: true,
          assignmentId: true,
          audioFile: { select: { originalName: true, sizeBytes: true } },
          ...(user.studentId ? { progress: { where: { studentId: user.studentId }, select: { positionSec: true, completedAt: true, playCount: true } } } : {}),
        },
      },
    },
  });
  if (!lesson) return null;
  const canEdit = await canEditLesson(user, lessonId);
  // students only see the classes they are in
  const classes = user.role === "STUDENT" ? [] : lesson.classes;

  // Listening Quiz (Phase 3): which quizzes the student was given / already handed in
  const quizIds = lesson.audioLessons.map((a) => a.assignmentId).filter((id): id is string => !!id);
  let assigned = new Set<string>();
  let submitted = new Set<string>();
  if (user.role === "STUDENT" && user.studentId && quizIds.length) {
    const rows = await db.assignment.findMany({ where: { AND: [{ id: { in: quizIds } }, assignedToStudentWhere(user.studentId)] }, select: { id: true } });
    assigned = new Set(rows.map((r) => r.id));
    const subs = await db.submission.findMany({
      where: { assignmentId: { in: quizIds }, studentId: user.studentId, status: { in: ["SUBMITTED", "GRADED", "NEEDS_REVISION"] } },
      select: { assignmentId: true },
    });
    submitted = new Set(subs.map((s) => s.assignmentId));
  }
  const audioLessons = lesson.audioLessons.map((a) => {
    const quiz = a.assignmentId ? { assignmentId: a.assignmentId, assigned: assigned.has(a.assignmentId), submitted: submitted.has(a.assignmentId) } : null;
    // "show after submitting the quiz": the transcript is not even sent to the browser before that
    const hideTranscript = user.role === "STUDENT" && a.transcriptMode === "AFTER_SUBMIT" && !(quiz && quiz.submitted);
    return { ...a, quiz, transcript: hideTranscript ? null : a.transcript };
  });
  return { lesson: { ...lesson, classes, audioLessons }, canEdit };
}

/** All attachments of the lessons a user can see in a class (Tài liệu tab). */
export async function materialsForClass(user: CurrentUser, classId: string) {
  const lessons = await lessonsForClass(user, classId);
  const visibleIds = lessons.filter((l) => user.role !== "STUDENT" || l.status === "PUBLISHED").map((l) => l.id);
  if (!visibleIds.length) return [];
  const rows = await db.lessonAttachment.findMany({
    where: { lessonId: { in: visibleIds }, material: { deletedAt: null } },
    orderBy: [{ lesson: { publishedAt: "desc" } }, { sortOrder: "asc" }],
    select: { ...attachmentSelect, lesson: { select: { id: true, title: true } } },
  });
  return rows;
}

/** Listening items in a class (Audio tab) with my progress (student) or completion stats (manager). */
export async function audioForClass(user: CurrentUser, classId: string) {
  const lessons = await lessonsForClass(user, classId);
  const ids = lessons.filter((l) => user.role !== "STUDENT" || l.status === "PUBLISHED").map((l) => l.id);
  if (!ids.length) return { items: [], memberCount: 0 };
  const manager = await canManageClass(user, classId);
  const members = manager ? await db.classMember.findMany({ where: { classId, status: "ACTIVE" }, select: { studentId: true } }) : [];
  const memberIds = members.map((m) => m.studentId);
  const items = await db.audioLesson.findMany({
    where: { lessonId: { in: ids } },
    orderBy: [{ lesson: { publishedAt: "desc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      title: true,
      coverFileId: true,
      lesson: { select: { id: true, title: true, status: true } },
      progress: {
        where: user.studentId ? { studentId: user.studentId } : { studentId: { in: memberIds } },
        select: { studentId: true, completedAt: true, positionSec: true, playCount: true },
      },
    },
  });
  return { items, memberCount: memberIds.length };
}

/** Classes the user may attach lessons to (lesson editor). */
export async function manageableClasses(user: CurrentUser) {
  return db.class.findMany({
    where: {
      deletedAt: null,
      status: { in: ["PLANNED", "ACTIVE"] },
      ...(user.role === "ADMIN" ? {} : { teachers: { some: { teacherId: user.teacherId ?? "" } } }),
    },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

/** Per-student listening status for one audio item — managers of a class that has the lesson. */
export async function audioStats(user: CurrentUser, audioLessonId: string) {
  const audio = await db.audioLesson.findUnique({
    where: { id: audioLessonId },
    select: { lesson: { select: { classes: { select: { classId: true } } } } },
  });
  if (!audio) return [];
  const classIds: string[] = [];
  for (const c of audio.lesson.classes) if (await canManageClass(user, c.classId)) classIds.push(c.classId);
  if (!classIds.length) return [];
  const members = await db.classMember.findMany({
    where: { classId: { in: classIds }, status: "ACTIVE" },
    distinct: ["studentId"],
    select: {
      student: {
        select: {
          id: true,
          user: { select: { fullName: true } },
          audioProgress: { where: { audioLessonId }, select: { completedAt: true, playCount: true, listenedSec: true, updatedAt: true } },
        },
      },
    },
  });
  return members.map((m) => ({ studentId: m.student.id, name: m.student.user.fullName, progress: m.student.audioProgress[0] ?? null }));
}
