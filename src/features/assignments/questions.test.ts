import { describe, expect, it } from "vitest";
import {
  correctAnswerText,
  draftToStorage,
  gradeAnswer,
  normalizeTyped,
  parseFillTemplate,
  questionDraftSchema,
  seededShuffle,
  storageToDraft,
  toStudentQuestion,
  type QuestionDraft,
  type StoredQuestion,
} from "./questions";

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

/** Build a stored question exactly like the service does (draft → storage → rows with ids). */
function stored(draft: QuestionDraft, points = 1): StoredQuestion {
  const parsed = questionDraftSchema.parse({ ...draft, points });
  const { config, options } = draftToStorage(parsed);
  return {
    id: uuid(),
    type: parsed.type,
    prompt: { text: parsed.prompt },
    points,
    mediaFileId: null,
    config,
    explanation: null,
    sortOrder: 0,
    options: options.map((o) => ({ ...o, id: uuid() })),
  };
}
const optId = (q: StoredQuestion, text: string) => q.options.find((o) => (o.content as { text: string }).text === text)!.id;

describe("auto-grader", () => {
  it("MULTIPLE_CHOICE: full points only for the correct option", () => {
    const q = stored({ type: "MULTIPLE_CHOICE", prompt: "2+2?", options: [{ text: "3", correct: false }, { text: "4", correct: true }] } as QuestionDraft, 2);
    expect(gradeAnswer(q, { optionId: optId(q, "4") })).toEqual({ auto: true, points: 2, isCorrect: true });
    expect(gradeAnswer(q, { optionId: optId(q, "3") })).toEqual({ auto: true, points: 0, isCorrect: false });
    expect(gradeAnswer(q, null)).toEqual({ auto: true, points: 0, isCorrect: false });
    expect(gradeAnswer(q, { optionId: "not-a-uuid" })).toMatchObject({ points: 0 });
  });

  it("TRUE_FALSE", () => {
    const q = stored({ type: "TRUE_FALSE", prompt: "Cats can fly.", correct: false } as QuestionDraft);
    expect(gradeAnswer(q, { optionId: optId(q, "False") })).toMatchObject({ points: 1, isCorrect: true });
    expect(gradeAnswer(q, { optionId: optId(q, "True") })).toMatchObject({ points: 0, isCorrect: false });
  });

  it("MULTIPLE_SELECT: partial credit, wrong picks subtract, never below 0", () => {
    const q = stored(
      { type: "MULTIPLE_SELECT", prompt: "Animals?", scoring: "PARTIAL", options: [{ text: "cat", correct: true }, { text: "dog", correct: true }, { text: "car", correct: false }] } as QuestionDraft,
      4,
    );
    const [cat, dog, car] = ["cat", "dog", "car"].map((t) => optId(q, t));
    expect(gradeAnswer(q, { optionIds: [cat, dog] })).toEqual({ auto: true, points: 4, isCorrect: true });
    expect(gradeAnswer(q, { optionIds: [cat] })).toEqual({ auto: true, points: 2, isCorrect: false });
    expect(gradeAnswer(q, { optionIds: [cat, car] })).toEqual({ auto: true, points: 0, isCorrect: false });
    expect(gradeAnswer(q, { optionIds: [car] })).toEqual({ auto: true, points: 0, isCorrect: false });
  });

  it("MULTIPLE_SELECT: all-or-nothing mode", () => {
    const q = stored({ type: "MULTIPLE_SELECT", prompt: "?", scoring: "ALL_OR_NOTHING", options: [{ text: "a", correct: true }, { text: "b", correct: true }, { text: "c", correct: false }] } as QuestionDraft);
    expect(gradeAnswer(q, { optionIds: [optId(q, "a")] }).points).toBe(0);
    expect(gradeAnswer(q, { optionIds: [optId(q, "a"), optId(q, "b")] }).points).toBe(1);
  });

  it("FILL_BLANK: per-blank partial credit, alternatives, lenient case/space/punctuation", () => {
    const q = stored({ type: "FILL_BLANK", prompt: "", text: "She [[goes]] to school and [[doesn't|does not]] like it." } as QuestionDraft, 2);
    expect(gradeAnswer(q, { blanks: { "0": " Goes ", "1": "does  not" } })).toEqual({ auto: true, points: 2, isCorrect: true });
    expect(gradeAnswer(q, { blanks: { "0": "goes", "1": "don’t" } })).toEqual({ auto: true, points: 1, isCorrect: false });
    expect(gradeAnswer(q, { blanks: { "1": "doesn’t." } })).toEqual({ auto: true, points: 1, isCorrect: false });
    expect(gradeAnswer(q, { blanks: {} }).points).toBe(0);
  });

  it("FILL_BLANK: case-sensitive mode", () => {
    const q = stored({ type: "FILL_BLANK", prompt: "", text: "I live in [[Da Nang]].", caseSensitive: true } as QuestionDraft);
    expect(gradeAnswer(q, { blanks: { "0": "da nang" } }).points).toBe(0);
    expect(gradeAnswer(q, { blanks: { "0": "Da Nang" } }).points).toBe(1);
  });

  it("MATCHING: per-pair partial credit", () => {
    const q = stored({ type: "MATCHING", prompt: "", pairs: [{ left: "dog", right: "con chó" }, { left: "cat", right: "con mèo" }, { left: "bird", right: "con chim" }, { left: "fish", right: "con cá" }] } as QuestionDraft, 4);
    const L = (t: string) => q.options.find((o) => o.matchSide === "LEFT" && (o.content as { text: string }).text === t)!.id;
    const R = (t: string) => q.options.find((o) => o.matchSide === "RIGHT" && (o.content as { text: string }).text === t)!.id;
    const all = { [L("dog")]: R("con chó"), [L("cat")]: R("con mèo"), [L("bird")]: R("con chim"), [L("fish")]: R("con cá") };
    expect(gradeAnswer(q, { pairs: all })).toEqual({ auto: true, points: 4, isCorrect: true });
    expect(gradeAnswer(q, { pairs: { ...all, [L("bird")]: R("con cá"), [L("fish")]: R("con chim") } })).toEqual({ auto: true, points: 2, isCorrect: false });
    // pointing at a LEFT option (forged id) never counts
    expect(gradeAnswer(q, { pairs: { [L("dog")]: L("dog") } }).points).toBe(0);
  });

  it("ORDERING: all-or-nothing", () => {
    const q = stored({ type: "ORDERING", prompt: "", items: ["I", "like", "English"] } as QuestionDraft, 3);
    const ids = ["I", "like", "English"].map((t) => optId(q, t));
    expect(gradeAnswer(q, { order: ids })).toEqual({ auto: true, points: 3, isCorrect: true });
    expect(gradeAnswer(q, { order: [ids[1], ids[0], ids[2]] })).toEqual({ auto: true, points: 0, isCorrect: false });
    expect(gradeAnswer(q, { order: ids.slice(0, 2) }).points).toBe(0);
  });

  it("SHORT_ANSWER: auto when it matches an accepted answer, otherwise the teacher decides", () => {
    const q = stored({ type: "SHORT_ANSWER", prompt: "Capital of Vietnam?", acceptedAnswers: ["Hanoi", "Ha Noi"] } as QuestionDraft);
    expect(gradeAnswer(q, { text: "ha noi." })).toEqual({ auto: true, points: 1, isCorrect: true });
    expect(gradeAnswer(q, { text: "Saigon" })).toEqual({ auto: false, points: null, isCorrect: null });
  });

  it("WRITING / SPEAKING / FILE_UPLOAD always need the teacher", () => {
    for (const d of [
      { type: "WRITING", prompt: "Write" },
      { type: "SPEAKING", prompt: "Say" },
      { type: "FILE_UPLOAD", prompt: "Upload" },
    ] as QuestionDraft[]) {
      expect(gradeAnswer(stored(d), { text: "x" }).auto).toBe(false);
    }
  });

  it("normalizeTyped", () => {
    expect(normalizeTyped("  It’s   OK! ")).toBe("it's ok");
    expect(normalizeTyped("It's OK", true)).toBe("It's OK");
  });
});

describe("student view never contains answers", () => {
  it("strips is_correct, match keys, positions, accepted answers and explanations", () => {
    const qs = [
      stored({ type: "MULTIPLE_CHOICE", prompt: "?", options: [{ text: "a", correct: true }, { text: "b", correct: false }] } as QuestionDraft),
      stored({ type: "MATCHING", prompt: "", pairs: [{ left: "dog", right: "chó" }, { left: "cat", right: "mèo" }] } as QuestionDraft),
      stored({ type: "ORDERING", prompt: "", items: ["one", "two", "three"] } as QuestionDraft),
      stored({ type: "FILL_BLANK", prompt: "", text: "I [[am]] here." } as QuestionDraft),
      stored({ type: "SHORT_ANSWER", prompt: "?", acceptedAnswers: ["secret-answer"] } as QuestionDraft),
    ];
    qs[0]!.explanation = { text: "because-secret" };
    for (const q of qs) {
      const json = JSON.stringify(toStudentQuestion(q, "seed", true));
      for (const leak of ["isCorrect", "is_correct", "matchKey", "correctPosition", "accepted", "secret-answer", "because-secret", "[[am]]", "config"]) {
        expect(json).not.toContain(leak);
      }
    }
    expect(JSON.stringify(toStudentQuestion(qs[3]!, "s", false))).not.toContain('"am"');
  });

  it("ordering items are never shown already solved; shuffles are stable per seed", () => {
    const q = stored({ type: "ORDERING", prompt: "", items: ["a", "b"] } as QuestionDraft);
    for (const seed of ["1", "2", "3", "4", "5", "6"]) {
      const v = toStudentQuestion(q, seed, false);
      expect(v.items!.map((i) => i.text)).toEqual(["b", "a"]);
    }
    expect(seededShuffle([1, 2, 3, 4, 5, 6], "x")).toEqual(seededShuffle([1, 2, 3, 4, 5, 6], "x"));
  });
});

describe("builder model", () => {
  it("round-trips every question type through storage", () => {
    const drafts = [
      { type: "MULTIPLE_CHOICE", prompt: "p", points: 1, options: [{ text: "a", correct: true }, { text: "b", correct: false }] },
      { type: "MULTIPLE_SELECT", prompt: "p", points: 2, scoring: "ALL_OR_NOTHING", options: [{ text: "a", correct: true }, { text: "b", correct: true }] },
      { type: "TRUE_FALSE", prompt: "p", points: 1, correct: false },
      { type: "FILL_BLANK", prompt: "p", points: 1, text: "A [[b|c]] d", caseSensitive: false },
      { type: "MATCHING", prompt: "p", points: 1, pairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }] },
      { type: "ORDERING", prompt: "p", points: 1, items: ["x", "y", "z"] },
      { type: "SHORT_ANSWER", prompt: "p", points: 1, acceptedAnswers: ["ok"] },
      { type: "WRITING", prompt: "p", points: 5, minWords: 50, maxWords: 120 },
      { type: "SPEAKING", prompt: "p", points: 5, maxDurationSec: 90 },
      { type: "FILE_UPLOAD", prompt: "p", points: 5, maxFiles: 2, allow: ["IMAGE"] },
    ] as QuestionDraft[];
    for (const d of drafts) {
      const q = stored(d, d.points);
      const back = storageToDraft(q);
      expect(back).toMatchObject({ ...d, id: q.id });
    }
  });

  it("validates drafts with friendly messages", () => {
    expect(questionDraftSchema.safeParse({ type: "MULTIPLE_CHOICE", prompt: "", options: [{ text: "a", correct: false }, { text: "b", correct: false }] }).success).toBe(false);
    expect(questionDraftSchema.safeParse({ type: "FILL_BLANK", prompt: "", text: "no blanks" }).success).toBe(false);
    expect(parseFillTemplate("A [[x]] B [[ ]] C").blanks).toEqual([{ id: 0, accepted: ["x"] }]);
  });

  it("correctAnswerText", () => {
    const q = stored({ type: "MATCHING", prompt: "", pairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }] } as QuestionDraft);
    expect(correctAnswerText(q)).toBe("a → 1 · b → 2");
  });
});
