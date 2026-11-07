"use client";

import { FileText, Pause, Play, Repeat, RotateCcw, RotateCw, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RichTextRenderer } from "@/components/editor/rich-text-renderer";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const REPORT_EVERY_SEC = 10;
const SPEED_KEY = "sala.audio.speed";

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function readSpeed(): number {
  try {
    const v = Number(localStorage.getItem(SPEED_KEY));
    return (SPEEDS as readonly number[]).includes(v) ? v : 1;
  } catch {
    return 1;
  }
}

export type AudioPlayerProps = {
  audioLessonId: string;
  src: string;
  title: string;
  coverSrc?: string | null;
  /** saved position for this student (seconds) */
  initialPosition?: number;
  initiallyCompleted?: boolean;
  transcript?: unknown;
  transcriptMode: "ALWAYS" | "AFTER_COMPLETE" | "AFTER_SUBMIT" | "HIDDEN";
  /** students: report progress; staff: preview only, transcript always visible */
  trackProgress: boolean;
  /** the student has handed in this item's Listening Quiz (for transcriptMode AFTER_SUBMIT) */
  quizSubmitted?: boolean;
};

/**
 * Mobile-first listening player: streams with HTTP Range (no download), ±10 s, speed 0.5–2×,
 * volume, A–B repeat, lock-screen controls, remembers the position and reports listening progress.
 */
export function AudioPlayer(props: AudioPlayerProps) {
  const { audioLessonId, src, title, coverSrc, initialPosition = 0, initiallyCompleted = false, transcript, transcriptMode, trackProgress, quizSubmitted = false } = props;
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [showTranscript, setShowTranscript] = useState(false);
  const [resumeOffer, setResumeOffer] = useState(trackProgress && initialPosition > 5 && !initiallyCompleted);
  const [error, setError] = useState<string | null>(null);

  // progress accounting (refs: no re-render needed)
  const listened = useRef(0);
  const lastTime = useRef<number | null>(null);
  const lastReport = useRef(0);
  const startedOnce = useRef(false);
  const pendingStarted = useRef(false);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed;
  }, [speed]);

  const report = useCallback(
    (opts: { ended?: boolean; keepalive?: boolean } = {}) => {
      if (!trackProgress || !audio.current) return;
      const delta = listened.current;
      if (delta < 0.5 && !opts.ended && !pendingStarted.current) return;
      listened.current = 0;
      const started = pendingStarted.current;
      pendingStarted.current = false;
      lastReport.current = Date.now();
      void fetch("/api/audio-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: opts.keepalive,
        body: JSON.stringify({
          audioLessonId,
          positionSec: audio.current.currentTime,
          listenedDeltaSec: Math.min(delta, 600),
          durationSec: Number.isFinite(audio.current.duration) ? audio.current.duration : undefined,
          started,
          ended: opts.ended,
        }),
      })
        .then(async (r) => {
          if (r.ok) {
            const p = (await r.json()) as { completedAt: string | null };
            if (p.completedAt) setCompleted(true);
          }
        })
        .catch(() => {
          // offline: keep the delta for the next report
          listened.current += delta;
        });
    },
    [audioLessonId, trackProgress],
  );

  // save when the page is hidden / closed
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && report({ keepalive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", () => report({ keepalive: true }));
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [report]);

  // lock-screen / headset controls
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: "Sala English Corner", artwork: coverSrc ? [{ src: coverSrc }] : [{ src: "/brand/icon-512.png", sizes: "512x512" }] });
    navigator.mediaSession.setActionHandler("play", () => void audio.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audio.current?.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => seek(-10));
    navigator.mediaSession.setActionHandler("seekforward", () => seek(10));
  });

  function seek(by: number) {
    const a = audio.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min((a.duration || 0) - 0.1, a.currentTime + by));
    lastTime.current = a.currentTime;
  }

  async function toggle() {
    const a = audio.current;
    if (!a) return;
    setResumeOffer(false);
    if (a.paused) {
      try {
        await a.play();
      } catch {
        setError("Không phát được. Hãy kiểm tra kết nối mạng và thử lại.");
      }
    } else a.pause();
  }

  function onTimeUpdate() {
    const a = audio.current!;
    const t = a.currentTime;
    // count only real listening: small forward steps while playing (seeks are ignored)
    if (!a.paused && lastTime.current !== null) {
      const d = t - lastTime.current;
      if (d > 0 && d < 2 * Math.max(1, a.playbackRate)) listened.current += d;
    }
    lastTime.current = t;
    if (loopA !== null && loopB !== null && t >= loopB) {
      a.currentTime = loopA;
      lastTime.current = loopA;
    }
    setTime(t);
    if (trackProgress && Date.now() - lastReport.current > REPORT_EVERY_SEC * 1000) report();
  }

  function toggleLoop() {
    if (loopA === null) setLoopA(time);
    else if (loopB === null) setLoopB(time > loopA ? time : null);
    else {
      setLoopA(null);
      setLoopB(null);
    }
  }

  const transcriptAllowed = !trackProgress || transcriptMode === "ALWAYS" || (transcriptMode === "AFTER_COMPLETE" && completed) || (transcriptMode === "AFTER_SUBMIT" && quizSubmitted);
  // AFTER_SUBMIT: the server does not send the transcript before the quiz is handed in — still show the locked button
  const hasTranscript = (!!transcript || (transcriptMode === "AFTER_SUBMIT" && trackProgress)) && transcriptMode !== "HIDDEN";
  const pct = duration ? (time / duration) * 100 : 0;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      {coverSrc && (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated file URL
        <img src={coverSrc} alt="" className="aspect-video w-full object-cover" />
      )}
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-ink">{title}</p>
          {trackProgress && completed && <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">Đã nghe xong</span>}
        </div>

        <audio
          ref={audio}
          src={src}
          preload="metadata"
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            const saved = readSpeed();
            setSpeed(saved);
            e.currentTarget.playbackRate = saved;
          }}
          onPlay={() => {
            setPlaying(true);
            lastTime.current = audio.current?.currentTime ?? 0;
            if (!startedOnce.current) {
              startedOnce.current = true;
              pendingStarted.current = true;
            }
          }}
          onPause={() => {
            setPlaying(false);
            report();
          }}
          onEnded={() => {
            setPlaying(false);
            report({ ended: true });
          }}
          onTimeUpdate={onTimeUpdate}
          onError={() => setError("Không tải được file âm thanh.")}
        />

        {resumeOffer && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-sky-50 p-2.5 text-sm">
            <span className="text-ink">Bạn đã nghe đến {fmt(initialPosition)}.</span>
            <button
              type="button"
              className="font-semibold text-blue-700 underline-offset-2 hover:underline"
              onClick={() => {
                if (audio.current) audio.current.currentTime = initialPosition;
                void toggle();
              }}
            >
              Nghe tiếp
            </button>
            <button type="button" className="text-ink-muted underline-offset-2 hover:underline" onClick={() => void toggle()}>
              Nghe từ đầu
            </button>
          </div>
        )}

        {/* seek bar */}
        <div className="grid gap-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => {
              if (audio.current) audio.current.currentTime = Number(e.target.value);
              lastTime.current = Number(e.target.value);
              setTime(Number(e.target.value));
            }}
            aria-label="Vị trí đang nghe"
            aria-valuetext={`${fmt(time)} trên ${fmt(duration)}`}
            className="h-2 w-full cursor-pointer accent-[var(--orange-700)]"
            style={{ background: `linear-gradient(to right, var(--orange-700) ${pct}%, var(--sky-100) ${pct}%)`, borderRadius: 999 }}
          />
          <div className="flex justify-between text-sm text-ink-muted tabular-nums">
            <span>{fmt(time)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* main controls */}
        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={() => seek(-10)} className="grid size-12 place-items-center rounded-full text-ink hover:bg-sky-50" aria-label="Lùi 10 giây">
            <RotateCcw className="size-6" />
            <span className="sr-only">-10s</span>
          </button>
          <button
            type="button"
            onClick={() => void toggle()}
            className="grid size-16 place-items-center rounded-full bg-primary text-white shadow-raised hover:bg-primary-hover"
            aria-label={playing ? "Tạm dừng" : "Phát"}
          >
            {playing ? <Pause className="size-7" /> : <Play className="ml-1 size-7" />}
          </button>
          <button type="button" onClick={() => seek(10)} className="grid size-12 place-items-center rounded-full text-ink hover:bg-sky-50" aria-label="Tới 10 giây">
            <RotateCw className="size-6" />
          </button>
        </div>

        {/* speed */}
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Tốc độ phát">
          <span className="mr-1 text-sm text-ink-muted">Tốc độ</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={speed === s}
              onClick={() => {
                setSpeed(s);
                try {
                  localStorage.setItem(SPEED_KEY, String(s));
                } catch {
                  /* private mode */
                }
              }}
              className={cn("h-8 min-w-11 rounded-full px-2 text-sm font-medium tabular-nums", speed === s ? "bg-sky-100 text-blue-700" : "text-ink hover:bg-sky-50")}
            >
              {String(s).replace(".", ",")}×
            </button>
          ))}
        </div>

        {/* volume + A-B + transcript */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-1 items-center gap-2 text-ink-muted">
            <Volume2 className="size-5 shrink-0" aria-hidden />
            <span className="sr-only">Âm lượng</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                if (audio.current) audio.current.volume = Number(e.target.value);
              }}
              className="w-full min-w-24 accent-[var(--blue-600)]"
            />
          </label>
          <button
            type="button"
            onClick={toggleLoop}
            aria-pressed={loopA !== null}
            className={cn("inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm", loopA !== null ? "border-blue-600 bg-sky-100 text-blue-700" : "border-line text-ink")}
            title="Lặp lại một đoạn: bấm lần 1 đánh dấu A, lần 2 đánh dấu B, lần 3 tắt"
          >
            <Repeat className="size-4" />
            {loopA === null ? "Lặp A–B" : loopB === null ? `A ${fmt(loopA)} → bấm chọn B` : `${fmt(loopA)}–${fmt(loopB)} · tắt`}
          </button>
          {hasTranscript && (
            <button
              type="button"
              disabled={!transcriptAllowed || !transcript}
              onClick={() => setShowTranscript((v) => !v)}
              aria-expanded={showTranscript}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm text-ink disabled:opacity-60"
            >
              <FileText className="size-4" />
              {transcriptAllowed && transcript ? (showTranscript ? "Ẩn transcript" : "Xem transcript") : transcriptMode === "AFTER_SUBMIT" ? "Transcript mở sau khi nộp bài nghe" : "Transcript mở sau khi nghe xong"}
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {showTranscript && transcriptAllowed && (
          <div className="max-h-80 overflow-y-auto rounded-md bg-cream p-3">
            <RichTextRenderer doc={transcript} className="text-[16px]" />
          </div>
        )}
      </div>
    </div>
  );
}
