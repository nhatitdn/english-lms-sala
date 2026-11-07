/**
 * DEMO data for local development and acceptance demos only.
 * Refuses to run in production. Run with:  SEED_DEMO=true npm run db:seed:demo
 * All demo accounts use the password "demo1234".
 */
import { TZDate } from "@date-fns/tz";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { hashPassword } from "../../src/server/auth/password";
import { createScriptClient } from "./client";

const TZ = "Asia/Ho_Chi_Minh";
const DEMO_PASSWORD = "demo1234";

function guard() {
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
    throw new Error("Refusing to seed demo data in production.");
  }
  if (process.env.SEED_DEMO !== "true") {
    throw new Error("Set SEED_DEMO=true to confirm you want demo data in this database.");
  }
}

/** Local Vietnam date-time → UTC Date. */
function vn(daysFromToday: number, hour: number, minute = 0): Date {
  const now = new TZDate(new Date(), TZ);
  return new Date(new TZDate(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday, hour, minute, TZ).getTime());
}

/** Copy a fixture into the upload store and register it (demo only — real uploads go through /api/uploads). */
function demoFile(db: ReturnType<typeof createScriptClient>, fixture: string, kind: "AUDIO" | "DOCUMENT", mimeType: string, uploadedBy: string, originalName: string) {
  const src = join(process.cwd(), "tests/fixtures", fixture);
  const ext = fixture.split(".").pop()!;
  const id = randomUUID();
  const storageKey = `private/demo/${id}.${ext}`;
  const dest = resolve(process.env.UPLOAD_DIR ?? "./data/uploads", storageKey);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  return db.file.create({
    data: {
      id,
      storageKey,
      kind,
      mimeType,
      extension: ext,
      originalName,
      sizeBytes: BigInt(statSync(dest).size),
      sha256: createHash("sha256").update(readFileSync(dest)).digest("hex"),
      uploadedBy,
    },
  });
}

function timeOfDay(hour: number, minute = 0): Date {
  return new Date(Date.UTC(1970, 0, 1, hour, minute));
}

async function main() {
  guard();
  const db = createScriptClient();
  try {
    if (await db.user.findUnique({ where: { username: "admin.demo" } })) {
      console.log("Demo data already present — nothing to do.");
      return;
    }
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const base = { passwordHash, mustChangePassword: false };

    const admin = await db.user.create({
      data: { ...base, username: "admin.demo", fullName: "Quản trị Demo", role: "ADMIN", email: "admin.demo@example.com" },
    });

    const lan = await db.user.create({
      data: {
        ...base,
        username: "gv.lan",
        fullName: "Trần Thị Lan",
        role: "TEACHER",
        teacher: { create: { slug: "co-lan", displayName: "Cô Lan", qualifications: "IELTS 8.0, TESOL" } },
      },
      include: { teacher: true },
    });
    const minh = await db.user.create({
      data: {
        ...base,
        username: "gv.minh",
        fullName: "Lê Văn Minh",
        role: "TEACHER",
        teacher: { create: { slug: "thay-minh", displayName: "Thầy Minh" } },
      },
      include: { teacher: true },
    });

    const studentData = [
      { username: "hv.minhanh", fullName: "Nguyễn Minh Anh", dob: "2016-03-12", level: "STARTER" as const, independent: false },
      { username: "hv.quocbao", fullName: "Phạm Quốc Bảo", dob: "2014-08-02", level: "STARTER" as const, independent: false },
      { username: "hv.giahan", fullName: "Võ Gia Hân", dob: "2015-11-20", level: "STARTER" as const, independent: false },
      { username: "hv.ducthinh", fullName: "Hoàng Đức Thịnh", dob: "2010-05-15", level: "PRE_INTERMEDIATE" as const, independent: false },
      { username: "hv.thao", fullName: "Đặng Phương Thảo", dob: "1996-01-30", level: "INTERMEDIATE" as const, independent: true },
    ];
    const students = [];
    for (const [i, s] of studentData.entries()) {
      const u = await db.user.create({
        data: {
          ...base,
          username: s.username,
          fullName: s.fullName,
          role: "STUDENT",
          student: {
            create: {
              studentCode: `HV${String(i + 1).padStart(4, "0")}`,
              dateOfBirth: new Date(s.dob),
              currentLevel: s.level,
              isIndependent: s.independent,
              guardianConsentAt: s.independent ? null : new Date(),
            },
          },
        },
        include: { student: true },
      });
      students.push(u.student!);
    }
    const [minhAnh, quocBao, giaHan, ducThinh, thao] = students as [
      (typeof students)[number],
      (typeof students)[number],
      (typeof students)[number],
      (typeof students)[number],
      (typeof students)[number],
    ];

    await db.user.create({
      data: {
        ...base,
        username: "ph.huong",
        fullName: "Nguyễn Thị Hương",
        role: "PARENT",
        phone: "0900000001",
        parent: {
          create: {
            children: {
              create: [
                { studentId: minhAnh.id, relationship: "MOTHER" },
                { studentId: quocBao.id, relationship: "GUARDIAN" },
              ],
            },
          },
        },
      },
    });

    const starter = await db.class.create({
      data: {
        code: "STA-2611",
        name: "Starter A",
        description: "Lớp Starter cho bé 8–11 tuổi",
        level: "STARTER",
        ageMin: 8,
        ageMax: 11,
        startDate: vn(-30, 0),
        status: "ACTIVE",
        location: "Phòng 201",
        teachers: { create: { teacherId: lan.teacher!.id, role: "MAIN" } },
        members: { create: [minhAnh, quocBao, giaHan].map((s) => ({ studentId: s.id })) },
        schedules: {
          create: [
            { weekday: 2, startTime: timeOfDay(17, 30), endTime: timeOfDay(19, 0), effectiveFrom: vn(-30, 0) },
            { weekday: 4, startTime: timeOfDay(17, 30), endTime: timeOfDay(19, 0), effectiveFrom: vn(-30, 0) },
          ],
        },
      },
    });
    const preInter = await db.class.create({
      data: {
        code: "PIN-2609",
        name: "Pre-Intermediate",
        level: "PRE_INTERMEDIATE",
        ageMin: 12,
        ageMax: 16,
        startDate: vn(-60, 0),
        status: "ACTIVE",
        location: "Phòng 202",
        teachers: { create: { teacherId: minh.teacher!.id, role: "MAIN" } },
        members: { create: [{ studentId: ducThinh.id }] },
      },
    });
    const adults = await db.class.create({
      data: {
        code: "ADU-2610",
        name: "Giao tiếp người lớn",
        level: "INTERMEDIATE",
        startDate: vn(-20, 0),
        status: "ACTIVE",
        location: "Online",
        teachers: { create: [{ teacherId: lan.teacher!.id, role: "MAIN" }, { teacherId: minh.teacher!.id, role: "ASSISTANT" }] },
        members: { create: [{ studentId: thao.id }] },
      },
    });

    // Sessions: today + a few around today, with attendance on past ones
    const sessionPlan = [
      { cls: starter, day: -7, h: 17, m: 30 },
      { cls: starter, day: -3, h: 17, m: 30 },
      { cls: starter, day: 0, h: 17, m: 30 },
      { cls: starter, day: 4, h: 17, m: 30 },
      { cls: preInter, day: 0, h: 19, m: 15 },
      { cls: preInter, day: 2, h: 19, m: 15 },
      { cls: adults, day: 1, h: 20, m: 0 },
    ];
    for (const p of sessionPlan) {
      const startsAt = vn(p.day, p.h, p.m);
      const session = await db.classSession.create({
        data: {
          classId: p.cls.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 90 * 60_000),
          status: p.day < 0 ? "COMPLETED" : "SCHEDULED",
          topic: p.day < 0 ? "Unit 2 — Animals" : null,
        },
      });
      if (p.day < 0 && p.cls.id === starter.id) {
        await db.attendance.createMany({
          data: [
            { sessionId: session.id, studentId: minhAnh.id, status: "PRESENT", markedBy: lan.id },
            { sessionId: session.id, studentId: quocBao.id, status: p.day === -3 ? "LATE" : "PRESENT", markedBy: lan.id },
            { sessionId: session.id, studentId: giaHan.id, status: p.day === -7 ? "EXCUSED" : "PRESENT", markedBy: lan.id },
          ],
        });
      }
    }

    // Assignments
    const quiz2 = await db.assignment.create({
      data: {
        title: "Unit 2 Quiz — Animals",
        kind: "QUIZ",
        maxScore: 10,
        status: "PUBLISHED",
        createdBy: lan.id,
        targets: { create: { classId: starter.id, targetType: "CLASS", availableAt: vn(-6, 8), dueAt: vn(-2, 21) } },
      },
    });
    const quiz3 = await db.assignment.create({
      data: {
        title: "Unit 3 Quiz — My family",
        kind: "QUIZ",
        maxScore: 10,
        status: "PUBLISHED",
        createdBy: lan.id,
        targets: { create: { classId: starter.id, targetType: "CLASS", availableAt: vn(-1, 8), dueAt: vn(1, 21) } },
      },
    });
    await db.assignment.create({
      data: {
        title: "Writing #1 — My weekend",
        kind: "WRITING",
        maxScore: 10,
        status: "PUBLISHED",
        createdBy: lan.id,
        targets: { create: { classId: adults.id, targetType: "CLASS", availableAt: vn(-2, 8), dueAt: vn(5, 21) } },
      },
    });

    // Minh Anh: graded quiz 2 + feedback; Quốc Bảo: submitted quiz 2 waiting for grading; Gia Hân: not submitted
    const subGraded = await db.submission.create({
      data: {
        assignmentId: quiz2.id,
        studentId: minhAnh.id,
        classId: starter.id,
        attemptNo: 1,
        status: "GRADED",
        startedAt: vn(-4, 19),
        submittedAt: vn(-4, 19, 20),
        autoScore: 9,
        finalScore: 9,
        grades: { create: { score: 9, maxScore: 10, source: "AUTO", isCurrent: true } },
      },
    });
    await db.feedback.create({
      data: {
        studentId: minhAnh.id,
        classId: starter.id,
        submissionId: subGraded.id,
        authorId: lan.id,
        content: "Con làm bài rất tốt, nhớ ôn lại từ vựng về động vật hoang dã nhé.",
      },
    });
    await db.submission.create({
      data: {
        assignmentId: quiz2.id,
        studentId: quocBao.id,
        classId: starter.id,
        attemptNo: 1,
        status: "SUBMITTED",
        startedAt: vn(-3, 20),
        submittedAt: vn(-2, 22),
        isLate: true,
        autoScore: 7,
      },
    });
    void quiz3;

    await db.notification.createMany({
      data: [
        { userId: (await db.student.findUniqueOrThrow({ where: { id: minhAnh.id } })).userId, type: "ASSIGNMENT_NEW", title: "Bài tập mới: Unit 3 Quiz — My family", link: "/app/student" },
        { userId: (await db.student.findUniqueOrThrow({ where: { id: minhAnh.id } })).userId, type: "ASSIGNMENT_GRADED", title: "Unit 2 Quiz đã được chấm: 9/10", link: "/app/student" },
      ],
    });

    // Phase 2: a published lesson with a listening item and a PDF, plus a draft
    const mp3 = await demoFile(db, "sample.mp3", "AUDIO", "audio/mpeg", lan.id, "family-listening.mp3");
    const pdf = await demoFile(db, "sample.pdf", "DOCUMENT", "application/pdf", lan.id, "Unit 3 - Worksheet.pdf");
    const worksheet = await db.learningMaterial.create({ data: { title: "Unit 3 — Worksheet", type: "DOCUMENT", fileId: pdf.id, skill: "VOCABULARY", tags: ["family", "unit 3"], ownerId: lan.id } });
    const song = await db.learningMaterial.create({ data: { title: "Family song (YouTube)", type: "YOUTUBE", url: "https://www.youtube.com/watch?v=FHaObkHEkHQ", skill: "LISTENING", tags: ["family", "song"], ownerId: lan.id } });
    const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
    await db.lesson.create({
      data: {
        title: "Unit 3 — My family",
        description: "Từ vựng về các thành viên trong gia đình và luyện nghe giới thiệu gia đình.",
        skill: "VOCABULARY",
        tags: ["family", "unit 3"],
        status: "PUBLISHED",
        publishedAt: vn(-1, 8),
        authorId: lan.id,
        content: {
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Từ vựng" }] },
            {
              type: "bulletList",
              content: ["mother — mẹ", "father — bố", "brother — anh/em trai", "sister — chị/em gái", "grandparents — ông bà"].map((t) => ({ type: "listItem", content: [p(t)] })),
            },
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Mẫu câu" }] },
            { type: "paragraph", content: [{ type: "text", text: "This is my mother. ", marks: [{ type: "bold" }] }, { type: "text", text: "She is a teacher." }] },
            { type: "blockquote", content: [p("Bài tập về nhà: vẽ cây gia đình và giới thiệu 3 thành viên bằng tiếng Anh.")] },
          ],
        },
        classes: { create: { classId: starter.id } },
        attachments: { create: [{ materialId: worksheet.id, sortOrder: 1 }, { materialId: song.id, sortOrder: 2 }] },
        audioLessons: {
          create: {
            title: "Listening — Meet my family",
            audioFileId: mp3.id,
            instructions: { type: "doc", content: [p("Nghe 2 lần. Lần 1 nghe ý chính, lần 2 ghi lại tên các thành viên.")] },
            transcript: { type: "doc", content: [p("Hi, I'm Anna. This is my family."), p("This is my father. His name is Tom."), p("And this is my mother, Lucy.")] },
            transcriptMode: "AFTER_COMPLETE",
            completeThreshold: 80,
          },
        },
      },
    });
    await db.lesson.create({ data: { title: "Unit 4 — My house (nháp)", skill: "GENERAL", authorId: lan.id, classes: { create: { classId: starter.id } } } });

    console.log("Demo data created. Accounts (password: demo1234):");
    console.log("  admin.demo · gv.lan · gv.minh · hv.minhanh · hv.quocbao · hv.giahan · hv.ducthinh · hv.thao · ph.huong");
    void admin;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
