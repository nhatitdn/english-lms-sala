/**
 * DEMO data for local development and acceptance demos only.
 * Refuses to run in production. Run with:  SEED_DEMO=true npm run db:seed:demo
 * All demo accounts use the password "demo1234".
 */
import { TZDate } from "@date-fns/tz";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  draftToStorage,
  gradeAnswer,
  questionDraftSchema,
  type StoredQuestion,
} from "../../src/features/assignments/questions";
import { hashPassword } from "../../src/server/auth/password";
import { createScriptClient } from "./client";

const TZ = "Asia/Ho_Chi_Minh";
const DEMO_PASSWORD = "demo1234";

function guard() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.APP_ENV === "production"
  ) {
    throw new Error("Refusing to seed demo data in production.");
  }
  if (process.env.SEED_DEMO !== "true") {
    throw new Error(
      "Set SEED_DEMO=true to confirm you want demo data in this database.",
    );
  }
}

/** Local Vietnam date-time → UTC Date. */
function vn(daysFromToday: number, hour: number, minute = 0): Date {
  const now = new TZDate(new Date(), TZ);
  return new Date(
    new TZDate(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + daysFromToday,
      hour,
      minute,
      TZ,
    ).getTime(),
  );
}

/** Copy a fixture into the upload store and register it (demo only — real uploads go through /api/uploads). */
function demoFile(
  db: ReturnType<typeof createScriptClient>,
  fixture: string,
  kind: "AUDIO" | "DOCUMENT",
  mimeType: string,
  uploadedBy: string,
  originalName: string,
) {
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
    // gv.lan is the marker: "admin.demo" may already be a real admin someone created by hand
    if (await db.user.findUnique({ where: { username: "gv.lan" } })) {
      console.log("Demo data already present — nothing to do.");
      return;
    }
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const base = { passwordHash, mustChangePassword: false };

    const existingAdmin = await db.user.findFirst({
      where: {
        OR: [{ username: "admin.demo" }, { email: "admin.demo@example.com" }],
      },
    });
    if (existingAdmin)
      console.log(
        `  "admin.demo" already exists — kept as is (its password is unchanged).`,
      );
    const admin =
      existingAdmin ??
      (await db.user.create({
        data: {
          ...base,
          username: "admin.demo",
          fullName: "Quản trị Demo",
          role: "ADMIN",
          email: "admin.demo@example.com",
        },
      }));

    const lan = await db.user.create({
      data: {
        ...base,
        username: "gv.lan",
        fullName: "Trần Thị Lan",
        role: "TEACHER",
        teacher: {
          create: {
            slug: "co-lan",
            displayName: "Cô Lan",
            qualifications: "IELTS 8.0, TESOL",
          },
        },
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
      {
        username: "hv.minhanh",
        fullName: "Nguyễn Minh Anh",
        dob: "2016-03-12",
        level: "STARTER" as const,
        independent: false,
      },
      {
        username: "hv.quocbao",
        fullName: "Phạm Quốc Bảo",
        dob: "2014-08-02",
        level: "STARTER" as const,
        independent: false,
      },
      {
        username: "hv.giahan",
        fullName: "Võ Gia Hân",
        dob: "2015-11-20",
        level: "STARTER" as const,
        independent: false,
      },
      {
        username: "hv.ducthinh",
        fullName: "Hoàng Đức Thịnh",
        dob: "2010-05-15",
        level: "PRE_INTERMEDIATE" as const,
        independent: false,
      },
      {
        username: "hv.thao",
        fullName: "Đặng Phương Thảo",
        dob: "1996-01-30",
        level: "INTERMEDIATE" as const,
        independent: true,
      },
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
        members: {
          create: [minhAnh, quocBao, giaHan].map((s) => ({ studentId: s.id })),
        },
        schedules: {
          create: [
            {
              weekday: 2,
              startTime: timeOfDay(17, 30),
              endTime: timeOfDay(19, 0),
              effectiveFrom: vn(-30, 0),
            },
            {
              weekday: 4,
              startTime: timeOfDay(17, 30),
              endTime: timeOfDay(19, 0),
              effectiveFrom: vn(-30, 0),
            },
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
        teachers: {
          create: [
            { teacherId: lan.teacher!.id, role: "MAIN" },
            { teacherId: minh.teacher!.id, role: "ASSISTANT" },
          ],
        },
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
            {
              sessionId: session.id,
              studentId: minhAnh.id,
              status: "PRESENT",
              markedBy: lan.id,
            },
            {
              sessionId: session.id,
              studentId: quocBao.id,
              status: p.day === -3 ? "LATE" : "PRESENT",
              markedBy: lan.id,
            },
            {
              sessionId: session.id,
              studentId: giaHan.id,
              status: p.day === -7 ? "EXCUSED" : "PRESENT",
              markedBy: lan.id,
            },
          ],
        });
      }
    }

    // Assignments (Phase 3): real questions, answers graded by the same pure grader the app uses
    type Draft = Parameters<typeof draftToStorage>[0];
    const makeAssignment = async (
      data: {
        title: string;
        kind: "QUIZ" | "WRITING" | "LISTENING";
        classId: string;
        availableAt: Date;
        dueAt: Date;
        description?: string;
        answerReveal?: "AFTER_SUBMIT" | "AFTER_DUE" | "NEVER";
        maxAttempts?: number | null;
        timeLimitMin?: number | null;
      },
      drafts: Draft[],
    ) => {
      const a = await db.assignment.create({
        data: {
          title: data.title,
          description: data.description,
          kind: data.kind,
          maxScore: 10,
          status: "PUBLISHED",
          createdBy: lan.id,
          answerReveal: data.answerReveal ?? "AFTER_DUE",
          maxAttempts: data.maxAttempts === undefined ? 1 : data.maxAttempts,
          timeLimitMin: data.timeLimitMin ?? null,
          targets: {
            create: {
              classId: data.classId,
              targetType: "CLASS",
              availableAt: data.availableAt,
              dueAt: data.dueAt,
            },
          },
        },
      });
      for (const [i, d] of drafts.entries()) {
        const parsed = questionDraftSchema.parse(d);
        const { config, options } = draftToStorage(parsed);
        await db.question.create({
          data: {
            assignmentId: a.id,
            type: parsed.type,
            prompt: { text: parsed.prompt },
            points: parsed.points,
            config: config as object,
            explanation: parsed.explanation
              ? { text: parsed.explanation }
              : undefined,
            sortOrder: i + 1,
            options: { create: options },
          },
        });
      }
      return a;
    };
    /** Hand in an attempt: answers are given as option TEXTS and translated to ids, then auto-graded. */
    const handIn = async (
      assignmentId: string,
      studentId: string,
      classId: string,
      at: Date,
      late: boolean,
      answerFor: (
        q: StoredQuestion,
        byText: (t: string, side?: "LEFT" | "RIGHT") => string,
      ) => unknown,
    ) => {
      const rows = await db.question.findMany({
        where: { assignmentId },
        orderBy: { sortOrder: "asc" },
        include: { options: true },
      });
      const qs: StoredQuestion[] = rows.map((r) => ({
        ...r,
        points: Number(r.points),
        config: r.config as Record<string, unknown>,
        options: r.options,
      }));
      let total = 0;
      let earned = 0;
      let allAuto = true;
      const answers = qs.map((q) => {
        const byText = (t: string, side?: "LEFT" | "RIGHT") =>
          q.options.find(
            (o) =>
              (o.content as { text: string }).text === t &&
              (!side || o.matchSide === side),
          )!.id;
        const answer = answerFor(q, byText);
        const g = gradeAnswer(q, answer);
        total += q.points;
        if (g.auto) earned += g.points;
        else allAuto = false;
        return {
          questionId: q.id,
          answer: answer as object,
          isCorrect: g.isCorrect,
          autoPoints: g.points,
        };
      });
      const score = Math.round((earned / total) * 10 * 100) / 100;
      return db.submission.create({
        data: {
          assignmentId,
          studentId,
          classId,
          attemptNo: 1,
          status: allAuto ? "GRADED" : "SUBMITTED",
          startedAt: new Date(at.getTime() - 20 * 60_000),
          submittedAt: at,
          isLate: late,
          autoScore: score,
          finalScore: allAuto ? score : null,
          answers: { create: answers },
          ...(allAuto
            ? {
                grades: {
                  create: {
                    score,
                    maxScore: 10,
                    source: "AUTO" as const,
                    isCurrent: true,
                  },
                },
              }
            : {}),
        },
      });
    };

    const quiz2 = await makeAssignment(
      {
        title: "Unit 2 Quiz — Animals",
        kind: "QUIZ",
        classId: starter.id,
        availableAt: vn(-6, 8),
        dueAt: vn(-2, 21),
      },
      [
        {
          type: "MULTIPLE_CHOICE",
          prompt: "Which animal can fly?",
          points: 2,
          options: [
            { text: "a fish", correct: false },
            { text: "a bird", correct: true },
            { text: "a cat", correct: false },
          ],
        },
        {
          type: "TRUE_FALSE",
          prompt: "An elephant is smaller than a mouse.",
          points: 2,
          correct: false,
        },
        {
          type: "FILL_BLANK",
          prompt: "Fill in the blanks.",
          points: 2,
          text: "A [[cow]] gives us milk. A [[bee|honeybee]] makes honey.",
          caseSensitive: false,
        },
        {
          type: "MATCHING",
          prompt: "Match the animals with their Vietnamese names.",
          points: 2,
          pairs: [
            { left: "dog", right: "con chó" },
            { left: "cat", right: "con mèo" },
            { left: "duck", right: "con vịt" },
            { left: "pig", right: "con lợn" },
          ],
        },
        {
          type: "ORDERING",
          prompt: "Put the words in order.",
          points: 2,
          items: ["The", "monkey", "is", "very", "funny"],
        },
      ] as Draft[],
    );
    const quiz3 = await makeAssignment(
      {
        title: "Unit 3 Quiz — My family",
        kind: "QUIZ",
        classId: starter.id,
        availableAt: vn(-1, 8),
        dueAt: vn(1, 21),
        description: "Làm bài trong 15 phút. Được làm 2 lần, lấy lần sau cùng.",
        maxAttempts: 2,
        timeLimitMin: 15,
        answerReveal: "AFTER_SUBMIT",
      },
      [
        {
          type: "MULTIPLE_CHOICE",
          prompt: "My father's mother is my ___.",
          points: 1,
          options: [
            { text: "aunt", correct: false },
            { text: "grandmother", correct: true },
            { text: "sister", correct: false },
            { text: "cousin", correct: false },
          ],
          explanation: "Mẹ của bố là bà nội: grandmother.",
        },
        {
          type: "MULTIPLE_SELECT",
          prompt: "Which words are family members? (choose all)",
          points: 2,
          scoring: "PARTIAL",
          options: [
            { text: "brother", correct: true },
            { text: "teacher", correct: false },
            { text: "uncle", correct: true },
            { text: "window", correct: false },
          ],
        },
        {
          type: "FILL_BLANK",
          prompt: "Complete the sentences.",
          points: 2,
          text: "This [[is]] my mother. She [[is]] a doctor.",
          caseSensitive: false,
        },
        {
          type: "SHORT_ANSWER",
          prompt:
            "How many people are there in your family? (Write a full sentence.)",
          points: 2,
          acceptedAnswers: [],
        },
        {
          type: "SPEAKING",
          prompt: "Introduce one family member in 3 sentences. (Ghi âm)",
          points: 3,
          maxDurationSec: 60,
        },
      ] as Draft[],
    );
    const writing1 = await makeAssignment(
      {
        title: "Writing #1 — My weekend",
        kind: "WRITING",
        classId: adults.id,
        availableAt: vn(-2, 8),
        dueAt: vn(5, 21),
        answerReveal: "NEVER",
        maxAttempts: 1,
      },
      [
        {
          type: "WRITING",
          prompt:
            "Write about what you did last weekend (80–120 words). Use the past simple.",
          points: 10,
          minWords: 80,
          maxWords: 120,
        },
      ] as Draft[],
    );

    // Minh Anh: quiz 2 graded 9/10 (+ feedback) · Quốc Bảo: quiz 2 late · Gia Hân: did not submit
    const subGraded = await handIn(
      quiz2.id,
      minhAnh.id,
      starter.id,
      vn(-4, 19, 20),
      false,
      (q, t) => {
        switch (q.type) {
          case "MULTIPLE_CHOICE":
            return { optionId: t("a bird") };
          case "TRUE_FALSE":
            return { optionId: t("False") };
          case "FILL_BLANK":
            return { blanks: { "0": "cow", "1": "bea" } };
          case "MATCHING":
            return {
              pairs: {
                [t("dog", "LEFT")]: t("con chó", "RIGHT"),
                [t("cat", "LEFT")]: t("con mèo", "RIGHT"),
                [t("duck", "LEFT")]: t("con vịt", "RIGHT"),
                [t("pig", "LEFT")]: t("con lợn", "RIGHT"),
              },
            };
          default:
            return {
              order: ["The", "monkey", "is", "very", "funny"].map((w) => t(w)),
            };
        }
      },
    );
    await db.feedback.create({
      data: {
        studentId: minhAnh.id,
        classId: starter.id,
        submissionId: subGraded.id,
        authorId: lan.id,
        content: "Con làm bài rất tốt, nhớ ôn lại cách viết từ “bee” nhé.",
      },
    });
    await handIn(quiz2.id, quocBao.id, starter.id, vn(-2, 22), true, (q, t) => {
      switch (q.type) {
        case "MULTIPLE_CHOICE":
          return { optionId: t("a bird") };
        case "TRUE_FALSE":
          return { optionId: t("True") };
        case "FILL_BLANK":
          return { blanks: { "0": "cow", "1": "bee" } };
        case "MATCHING":
          return {
            pairs: {
              [t("dog", "LEFT")]: t("con chó", "RIGHT"),
              [t("cat", "LEFT")]: t("con mèo", "RIGHT"),
              [t("duck", "LEFT")]: t("con lợn", "RIGHT"),
              [t("pig", "LEFT")]: t("con vịt", "RIGHT"),
            },
          };
        default:
          return {
            order: ["The", "monkey", "is", "very", "funny"].map((w) => t(w)),
          };
      }
    });
    // Thảo handed in her writing → waits in the teacher's grading queue
    await handIn(writing1.id, thao.id, adults.id, vn(0, 7, 30), false, () => ({
      text: "Last weekend I visited my grandparents in Hoi An. On Saturday morning we went to the market and bought fresh vegetables and fish. My grandmother cooked a delicious lunch for the whole family. In the afternoon I walked along the river with my cousin and we took a lot of photos. On Sunday I stayed at home, cleaned my room and watched a film with my husband. In the evening we had dinner at a small restaurant near our house. It was a relaxing weekend and I felt happy.",
    }));
    void quiz3;

    await db.notification.createMany({
      data: [
        {
          userId: (
            await db.student.findUniqueOrThrow({ where: { id: minhAnh.id } })
          ).userId,
          type: "ASSIGNMENT_NEW",
          title: "Bài tập mới: Unit 3 Quiz — My family",
          link: `/app/assignments/${quiz3.id}`,
          dedupeKey: quiz3.id,
        },
        {
          userId: (
            await db.student.findUniqueOrThrow({ where: { id: minhAnh.id } })
          ).userId,
          type: "ASSIGNMENT_GRADED",
          title: "Unit 2 Quiz — Animals: 9/10 điểm",
          link: `/app/submissions/${subGraded.id}`,
          dedupeKey: `auto:${subGraded.id}`,
        },
      ],
    });

    // Phase 2: a published lesson with a listening item and a PDF, plus a draft
    const mp3 = await demoFile(
      db,
      "sample.mp3",
      "AUDIO",
      "audio/mpeg",
      lan.id,
      "family-listening.mp3",
    );
    const pdf = await demoFile(
      db,
      "sample.pdf",
      "DOCUMENT",
      "application/pdf",
      lan.id,
      "Unit 3 - Worksheet.pdf",
    );
    const worksheet = await db.learningMaterial.create({
      data: {
        title: "Unit 3 — Worksheet",
        type: "DOCUMENT",
        fileId: pdf.id,
        skill: "VOCABULARY",
        tags: ["family", "unit 3"],
        ownerId: lan.id,
      },
    });
    const song = await db.learningMaterial.create({
      data: {
        title: "Family song (YouTube)",
        type: "YOUTUBE",
        url: "https://www.youtube.com/watch?v=FHaObkHEkHQ",
        skill: "LISTENING",
        tags: ["family", "song"],
        ownerId: lan.id,
      },
    });
    const p = (text: string) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    });
    // Listening Quiz: questions about the audio of Unit 3 (same assignment engine)
    const listeningQuiz = await makeAssignment(
      {
        title: "Listening: Meet my family",
        kind: "LISTENING",
        classId: starter.id,
        availableAt: vn(-1, 8),
        dueAt: vn(3, 21),
        answerReveal: "AFTER_SUBMIT",
        maxAttempts: 2,
      },
      [
        {
          type: "MULTIPLE_CHOICE",
          prompt: "What is the girl's name?",
          points: 1,
          options: [
            { text: "Anna", correct: true },
            { text: "Lucy", correct: false },
            { text: "Tom", correct: false },
          ],
        },
        {
          type: "FILL_BLANK",
          prompt: "Listen and complete.",
          points: 2,
          text: "Her father's name is [[Tom]]. Her mother's name is [[Lucy]].",
          caseSensitive: false,
        },
        {
          type: "TRUE_FALSE",
          prompt: "The girl talks about her brother.",
          points: 1,
          correct: false,
        },
      ] as Draft[],
    );
    await db.lesson.create({
      data: {
        title: "Unit 3 — My family",
        description:
          "Từ vựng về các thành viên trong gia đình và luyện nghe giới thiệu gia đình.",
        skill: "VOCABULARY",
        tags: ["family", "unit 3"],
        status: "PUBLISHED",
        publishedAt: vn(-1, 8),
        authorId: lan.id,
        content: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Từ vựng" }],
            },
            {
              type: "bulletList",
              content: [
                "mother — mẹ",
                "father — bố",
                "brother — anh/em trai",
                "sister — chị/em gái",
                "grandparents — ông bà",
              ].map((t) => ({ type: "listItem", content: [p(t)] })),
            },
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Mẫu câu" }],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "This is my mother. ",
                  marks: [{ type: "bold" }],
                },
                { type: "text", text: "She is a teacher." },
              ],
            },
            {
              type: "blockquote",
              content: [
                p(
                  "Bài tập về nhà: vẽ cây gia đình và giới thiệu 3 thành viên bằng tiếng Anh.",
                ),
              ],
            },
          ],
        },
        classes: { create: { classId: starter.id } },
        attachments: {
          create: [
            { materialId: worksheet.id, sortOrder: 1 },
            { materialId: song.id, sortOrder: 2 },
          ],
        },
        audioLessons: {
          create: {
            title: "Listening — Meet my family",
            audioFileId: mp3.id,
            instructions: {
              type: "doc",
              content: [
                p(
                  "Nghe 2 lần. Lần 1 nghe ý chính, lần 2 ghi lại tên các thành viên.",
                ),
              ],
            },
            transcript: {
              type: "doc",
              content: [
                p("Hi, I'm Anna. This is my family."),
                p("This is my father. His name is Tom."),
                p("And this is my mother, Lucy."),
              ],
            },
            transcriptMode: "AFTER_COMPLETE",
            completeThreshold: 80,
            assignmentId: listeningQuiz.id,
          },
        },
      },
    });
    await db.lesson.create({
      data: {
        title: "Unit 4 — My house (nháp)",
        skill: "GENERAL",
        authorId: lan.id,
        classes: { create: { classId: starter.id } },
      },
    });

    console.log("Demo data created. Accounts (password: demo1234):");
    console.log(
      "  admin.demo · gv.lan · gv.minh · hv.minhanh · hv.quocbao · hv.giahan · hv.ducthinh · hv.thao · ph.huong",
    );
    void admin;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
