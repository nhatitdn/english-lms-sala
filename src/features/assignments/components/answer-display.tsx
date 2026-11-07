import { FileText } from "lucide-react";
import { countWords, type StudentQuestion } from "../questions";

type Item = {
  question: StudentQuestion;
  answer: unknown;
  files: { id: string; originalName: string; kind: string; mimeType: string }[];
  optionText: Record<string, string>;
};

const none = <p className="text-ink-muted italic">(Không trả lời)</p>;

/** Read-only rendering of one answer, for result and grading screens (server component). */
export function AnswerDisplay({ item }: { item: Item }) {
  const a = (item.answer ?? null) as Record<string, unknown> | null;
  const q = item.question;
  const t = (id: unknown) => item.optionText[String(id)] ?? "?";
  switch (q.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
      return a?.optionId ? <p className="font-medium text-ink">{q.type === "TRUE_FALSE" ? (t(a.optionId) === "True" ? "Đúng (True)" : "Sai (False)") : t(a.optionId)}</p> : none;
    case "MULTIPLE_SELECT": {
      const ids = (a?.optionIds as string[] | undefined) ?? [];
      return ids.length ? <p className="font-medium text-ink">{ids.map(t).join(" · ")}</p> : none;
    }
    case "FILL_BLANK": {
      const blanks = (a?.blanks as Record<string, string> | undefined) ?? {};
      return (
        <p className="leading-8 text-ink">
          {q.segments!.map((s, i) =>
            typeof s === "string" ? (
              <span key={i}>{s}</span>
            ) : (
              <span key={i} className="mx-0.5 rounded-sm border-b-2 border-blue-600 bg-sky-50 px-1.5 font-medium">
                {blanks[String(s.blank)]?.trim() || "___"}
              </span>
            ),
          )}
        </p>
      );
    }
    case "MATCHING": {
      const pairs = (a?.pairs as Record<string, string> | undefined) ?? {};
      return (
        <ul className="grid gap-1 text-ink">
          {q.left!.map((l) => (
            <li key={l.id}>
              {l.text} → <span className="font-medium">{pairs[l.id] ? t(pairs[l.id]) : "—"}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "ORDERING": {
      const order = (a?.order as string[] | undefined) ?? [];
      return order.length ? <p className="font-medium text-ink">{order.map(t).join(" ")}</p> : none;
    }
    case "SHORT_ANSWER":
    case "WRITING": {
      const text = String(a?.text ?? "").trim();
      if (!text) return none;
      return (
        <div className="grid gap-1">
          <p className="rounded-md bg-sky-50 p-3 whitespace-pre-wrap text-ink">{text}</p>
          {q.type === "WRITING" && <p className="text-sm text-ink-muted">{countWords(text)} từ</p>}
        </div>
      );
    }
    case "SPEAKING": {
      const f = item.files[0];
      return f ? <audio controls preload="metadata" src={`/api/files/${f.id}`} className="w-full" /> : none;
    }
    case "FILE_UPLOAD":
      return item.files.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {item.files.map((f) => (
            <li key={f.id}>
              <a href={`/api/files/${f.id}`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-md border border-line p-2 hover:bg-sky-50">
                {f.kind === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${f.id}`} alt={f.originalName} className="size-16 rounded-sm object-cover" />
                ) : (
                  <FileText className="size-6 text-blue-600" aria-hidden />
                )}
                <span className="truncate text-sm">{f.originalName}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        none
      );
  }
}
