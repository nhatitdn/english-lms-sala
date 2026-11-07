"use client";

import { AlertTriangle, CheckCircle2, CloudOff, Loader2, Send, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/misc";
import { AudioPlayer } from "@/features/audio/components/audio-player";
import { cn } from "@/lib/utils";
import { submitAttemptAction } from "../actions";
import type { AttemptView } from "../attempt";
import { isAnswered } from "../questions";
import { QuestionInput, QuestionPrompt, type FileInfo } from "./question-input";

type Answer = Record<string, unknown> | null | undefined;
type SaveState = "saved" | "dirty" | "saving" | "offline" | "error";
type Local = { answers: Record<string, unknown>; dirty: string[]; at: number };

const AUTOSAVE_DELAY = 1500;
const RETRY_EVERY = 15_000;
const storageKey = (id: string) => `sala.sub.${id}`;

function readLocal(id: string): Local | null {
  try {
    const raw = localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as Local) : null;
  } catch {
    return null;
  }
}
function writeLocal(id: string, data: Local | null) {
  try {
    if (data) localStorage.setItem(storageKey(id), JSON.stringify(data));
    else localStorage.removeItem(storageKey(id));
  } catch {
    /* private mode / quota: server autosave still works */
  }
}

/**
 * The attempt screen. Answers live in memory, are mirrored to localStorage on every change (survives a
 * reload or a dead battery), and are sent to the server ~1.5 s after the last change, on a timer while
 * offline, and with `keepalive` when the page is hidden. The countdown uses the server's clock.
 */
export function AttemptClient({ view }: { view: AttemptView }) {
  const router = useRouter();
  const id = view.submissionId;
  const [answers, setAnswers] = useState<Record<string, unknown>>(view.answers);
  const [files, setFiles] = useState<FileInfo[]>(() => Object.values(view.files).flat());
  const [state, setState] = useState<SaveState>("saved");
  const [online, setOnline] = useState(true);
  const [conflict, setConflict] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const version = useRef(view.version);
  const dirty = useRef(new Set<string>());
  const answersRef = useRef(answers);
  const inFlight = useRef(false);
  const debounce = useRef<number | null>(null);
  const finished = useRef(false);

  // ── recover unsaved answers from this device (reload, crash, offline) ──
  useEffect(() => {
    const local = readLocal(id);
    if (local && local.dirty.length) {
      const merged = { ...view.answers };
      for (const q of local.dirty) if (q in local.answers) merged[q] = local.answers[q];
      answersRef.current = merged;
      local.dirty.forEach((q) => dirty.current.add(q));
      // restoring persisted client state on mount
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnswers(merged);
      setState("dirty");
      toast.info("Đã khôi phục câu trả lời chưa kịp lưu trên máy này.");
    }
    setOnline(navigator.onLine);
  }, [id, view.answers]);

  const persistLocal = useCallback(() => writeLocal(id, dirty.current.size ? { answers: answersRef.current, dirty: [...dirty.current], at: Date.now() } : null), [id]);

  const flush = useCallback(
    async (opts: { keepalive?: boolean } = {}) => {
      if (finished.current || inFlight.current || dirty.current.size === 0) return;
      const sending = [...dirty.current];
      const snapshot = Object.fromEntries(sending.map((q) => [q, answersRef.current[q] ?? null]));
      inFlight.current = true;
      setState("saving");
      try {
        const res = await fetch(`/api/submissions/${id}/answers`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: version.current, answers: snapshot }),
          keepalive: opts.keepalive,
        });
        if (res.ok) {
          const body = (await res.json()) as { version: number };
          version.current = body.version;
          // only clear what did not change while the request was in flight
          for (const q of sending) if (answersRef.current[q] === snapshot[q]) dirty.current.delete(q);
          persistLocal();
          setState(dirty.current.size ? "dirty" : "saved");
          setOnline(true);
        } else if (res.status === 409) {
          const body = (await res.json().catch(() => ({}))) as { reason?: string };
          if (body.reason === "closed") {
            finished.current = true;
            writeLocal(id, null);
            toast.info("Bài đã được nộp (hết giờ hoặc đã nộp ở nơi khác).");
            router.replace(`/app/submissions/${id}`);
          } else setConflict(true);
        } else if (res.status === 401) {
          setState("error");
          toast.error("Phiên đăng nhập đã hết hạn. Câu trả lời vẫn được giữ trên máy — hãy đăng nhập lại ở tab khác rồi quay lại.");
        } else {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          setState("error");
          if (res.status === 422 && body.error?.message) toast.error(body.error.message);
        }
      } catch {
        setState("offline");
        setOnline(false);
      } finally {
        inFlight.current = false;
      }
    },
    [id, persistLocal, router],
  );

  const setAnswer = useCallback(
    (qid: string, v: Answer | ((prev: Answer) => Answer)) => {
      const prev = answersRef.current[qid] as Answer;
      const next = typeof v === "function" ? v(prev) : v;
      answersRef.current = { ...answersRef.current, [qid]: next ?? null };
      setAnswers(answersRef.current);
      dirty.current.add(qid);
      persistLocal();
      setState((s) => (s === "offline" ? s : "dirty"));
      if (debounce.current) window.clearTimeout(debounce.current);
      debounce.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY);
    },
    [flush, persistLocal],
  );

  // retry loop + connectivity + save when the page is hidden/closed
  useEffect(() => {
    const retry = window.setInterval(() => void flush(), RETRY_EVERY);
    const on = () => {
      setOnline(true);
      void flush();
    };
    const off = () => {
      setOnline(false);
      setState("offline");
    };
    const hide = () => {
      if (document.visibilityState === "hidden") void flush({ keepalive: true });
    };
    const leave = () => void flush({ keepalive: true });
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current.size && !finished.current) e.preventDefault();
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    window.addEventListener("beforeunload", warn);
    return () => {
      window.clearInterval(retry);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("beforeunload", warn);
    };
  }, [flush]);

  const submit = useCallback(
    (auto = false) => {
      if (finished.current) return;
      startSubmit(async () => {
        const pending = Object.fromEntries([...dirty.current].map((q) => [q, answersRef.current[q] ?? null]));
        const r = await submitAttemptAction({ submissionId: id, version: version.current, answers: pending });
        if (!r.ok) {
          if (auto) toast.error("Hết giờ nhưng chưa nộp được — sẽ thử lại khi có mạng.");
          else toast.error(r.error.message);
          return;
        }
        finished.current = true;
        writeLocal(id, null);
        toast.success(auto ? "Hết giờ — bài đã được nộp tự động." : "Đã nộp bài!");
        router.replace(`/app/submissions/${id}`);
      });
    },
    [id, router],
  );

  const answeredCount = useMemo(() => view.questions.filter((q) => isAnswered(q.type, answers[q.id])).length, [answers, view.questions]);
  const unanswered = view.questions.length - answeredCount;

  return (
    <div className="mx-auto grid max-w-3xl gap-4 pb-28">
      <header className="grid gap-1">
        <p className="text-sm text-ink-muted">Lần làm {view.attemptNo}</p>
        <h1 className="text-xl leading-7 font-semibold text-ink sm:text-2xl">{view.assignment.title}</h1>
        {view.assignment.description && <p className="whitespace-pre-line text-ink-muted">{view.assignment.description}</p>}
      </header>

      {!online && (
        <Alert tone="warning" title="Mất kết nối mạng">
          Cứ tiếp tục làm bài — câu trả lời được giữ trên máy và tự gửi lên khi có mạng lại.
        </Alert>
      )}

      {view.listening && (
        <div className="sticky top-14 z-10 sm:static">
          <AudioPlayer audioLessonId="quiz" src={`/api/files/${view.listening.audioFileId}`} coverSrc={view.listening.coverFileId ? `/api/files/${view.listening.coverFileId}` : null} title={view.listening.title} transcriptMode="HIDDEN" trackProgress={false} />
        </div>
      )}

      <nav aria-label="Danh sách câu hỏi" className="flex flex-wrap gap-1.5">
        {view.questions.map((q, i) => (
          <a
            key={q.id}
            href={`#q${i + 1}`}
            className={cn(
              "grid size-9 place-items-center rounded-full border text-sm font-medium",
              isAnswered(q.type, answers[q.id]) ? "border-blue-600 bg-blue-600 text-white" : "border-line bg-surface text-ink",
            )}
            aria-label={`Câu ${i + 1}${isAnswered(q.type, answers[q.id]) ? " (đã trả lời)" : ""}`}
          >
            {i + 1}
          </a>
        ))}
      </nav>

      <ol className="grid gap-4">
        {view.questions.map((q, i) => (
          <li key={q.id} id={`q${i + 1}`} className="scroll-mt-24 rounded-lg border border-line bg-surface p-4 shadow-card sm:p-5" data-testid="attempt-question">
            <div className="grid gap-3">
              <QuestionPrompt q={q} index={i + 1} />
              <QuestionInput
                q={q}
                value={answers[q.id] as Answer}
                onChange={(v) => setAnswer(q.id, v)}
                files={files}
                onFiles={(f) => setFiles((prev) => [...prev.filter((x) => x.id !== f.id), f])}
              />
            </div>
          </li>
        ))}
      </ol>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 shadow-raised backdrop-blur pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
            <span className="font-medium text-ink tabular-nums">
              Đã làm {answeredCount}/{view.questions.length}
            </span>
            <SaveIndicator state={state} />
          </div>
          {view.deadlineAt && <Countdown deadline={view.deadlineAt} serverNow={view.serverNow} onExpire={() => submit(true)} />}
          <Button variant="primary" size="lg" loading={submitting} onClick={() => setConfirming(true)}>
            <Send /> Nộp bài
          </Button>
        </div>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nộp bài?</DialogTitle>
            <DialogDescription>
              {unanswered > 0 ? `Bạn còn ${unanswered} câu chưa trả lời. ` : "Bạn đã trả lời tất cả các câu. "}
              Sau khi nộp sẽ không sửa được nữa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Làm tiếp
            </Button>
            <Button
              variant="primary"
              loading={submitting}
              onClick={() => {
                setConfirming(false);
                submit();
              }}
            >
              Nộp bài
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conflict}>
        <DialogContent onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Bài đang mở ở nơi khác</DialogTitle>
            <DialogDescription>Bài làm này vừa được lưu từ một tab hoặc thiết bị khác. Tải lại trang để tiếp tục với bản mới nhất.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="primary"
              onClick={() => {
                writeLocal(id, null);
                window.location.reload();
              }}
            >
              Tải lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map = {
    saved: { icon: CheckCircle2, text: "Đã lưu", cls: "text-success" },
    dirty: { icon: Loader2, text: "Chưa lưu…", cls: "text-ink-muted" },
    saving: { icon: Loader2, text: "Đang lưu…", cls: "text-ink-muted" },
    offline: { icon: CloudOff, text: "Offline — lưu trên máy", cls: "text-warning" },
    error: { icon: AlertTriangle, text: "Chưa lưu được — đang thử lại", cls: "text-danger" },
  }[state];
  const Icon = map.icon;
  return (
    <span className={cn("flex items-center gap-1", map.cls)} role="status" data-testid="save-state" data-state={state}>
      <Icon className={cn("size-3.5", state === "saving" && "animate-spin")} aria-hidden /> {map.text}
    </span>
  );
}

/** Countdown against the server clock (the phone's clock may be wrong). */
function Countdown({ deadline, serverNow, onExpire }: { deadline: string; serverNow: string; onExpire: () => void }) {
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const end = new Date(deadline).getTime();
  const [left, setLeft] = useState(() => end - (Date.now() + offset));
  const fired = useRef(false);
  useEffect(() => {
    const t = window.setInterval(() => {
      const l = end - (Date.now() + offset);
      setLeft(l);
      if (l <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    }, 500);
    return () => window.clearInterval(t);
  }, [end, offset, onExpire]);
  const s = Math.max(0, Math.floor(left / 1000));
  const h = Math.floor(s / 3600);
  const text = `${h ? `${h}:` : ""}${String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
  const low = left < 60_000;
  return (
    <span className={cn("flex items-center gap-1 rounded-md px-2 py-1 font-semibold tabular-nums", low ? "bg-danger/10 text-danger" : "bg-sky-100 text-blue-700")} role="timer" aria-live={low ? "assertive" : "off"} aria-label={`Thời gian còn lại ${text}`}>
      <Timer className="size-4" aria-hidden /> {text}
    </span>
  );
}
