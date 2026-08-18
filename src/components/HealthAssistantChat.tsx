import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, MessageCircleHeart, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { SEVERITIES, SYMPTOMS, label } from "@/lib/types";
import type { Prediction } from "@/lib/types";
import { Panel } from "@/components/Panel";

type Stage = "SYMPTOMS" | "DURATION" | "SEVERITY" | "TEMPERATURE" | "REVIEW" | "RESULT";
type Message = { id: number; role: "assistant" | "user"; content: string };
type Intake = {
  symptoms: string[];
  durationHours?: number;
  severity?: string;
  temperature?: number | null;
};

const WORDS: Record<string, string> = {
  diarrhea: "DIARRHEA",
  diarrhoea: "DIARRHEA",
  vomiting: "VOMITING",
  vomit: "VOMITING",
  fever: "FEVER",
  "abdominal pain": "ABDOMINAL_PAIN",
  dehydration: "DEHYDRATION",
  nausea: "NAUSEA",
  "blood in stool": "BLOOD_IN_STOOL",
  headache: "HEADACHE",
  weakness: "WEAKNESS",
  weak: "WEAKNESS",
  cramps: "MUSCLE_CRAMPS",
};
const welcome: Message = {
  id: 1,
  role: "assistant",
  content:
    "Hi! I’m the WaterWatch assistant. Tell me what you’re experiencing, and I’ll organise it for an educational health assessment. You can type naturally or choose an option below.",
};

function parse(text: string, current: Intake): Intake {
  const lower = text.toLowerCase();
  const symptoms = [...current.symptoms];
  Object.entries(WORDS).forEach(([word, symptom]) => {
    if (lower.includes(word) && !symptoms.includes(symptom)) symptoms.push(symptom);
  });
  const hours = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/)?.[1];
  const days = lower.match(/(\d+(?:\.\d+)?)\s*days?/)?.[1];
  const temp = lower.match(/(?:temperature|temp)\s*(?:is|of|was)?\s*(\d{2}(?:\.\d+)?)/)?.[1];
  return {
    ...current,
    symptoms,
    durationHours: hours
      ? Math.round(Number(hours))
      : days
        ? Math.round(Number(days) * 24)
        : lower.includes("yesterday")
          ? 24
          : current.durationHours,
    temperature: temp ? Number(temp) : current.temperature,
    severity: /\bsevere\b/.test(lower)
      ? "SEVERE"
      : /\bmild\b/.test(lower)
        ? "MILD"
        : /\bmoderate\b/.test(lower)
          ? "MODERATE"
          : current.severity,
  };
}
function stageFor(i: Intake): Stage {
  if (!i.symptoms.length) return "SYMPTOMS";
  if (!i.durationHours) return "DURATION";
  if (!i.severity) return "SEVERITY";
  if (i.temperature === undefined) return "TEMPERATURE";
  return "REVIEW";
}
function ask(stage: Stage, i: Intake) {
  if (stage === "DURATION")
    return `Got it — I’ve recorded ${i.symptoms.map(label).join(" and ")}. How long has this been going on?`;
  if (stage === "SEVERITY") return "How severe do your symptoms feel right now?";
  if (stage === "TEMPERATURE") return "Do you know your temperature? It is optional.";
  if (stage === "REVIEW")
    return "I have the details I need. Please review your summary before submitting.";
  return "I want to make sure I record that correctly. Which symptoms are you experiencing?";
}

export function HealthAssistantChat({ onSubmitted }: { onSubmitted?: (() => void) | undefined }) {
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [intake, setIntake] = useState<Intake>({ symptoms: [] });
  const [stage, setStage] = useState<Stage>("SYMPTOMS");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(
    () => bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    [messages, busy, stage],
  );
  const add = (role: Message["role"], content: string) =>
    setMessages((m) => [...m, { id: Date.now() + Math.random(), role, content }]);
  const advance = (next: Intake) => {
    setIntake(next);
    const nextStage = stageFor(next);
    setStage(nextStage);
    add("assistant", ask(nextStage, next));
  };
  const send = (value = draft) => {
    const text = value.trim();
    if (!text || busy || stage === "RESULT") return;
    setDraft("");
    setError(false);
    add("user", text);
    advance(parse(text, intake));
  };
  const answer = (text: string, next: Intake) => {
    add("user", text);
    advance(next);
  };
  const edit = (part: "symptoms" | "duration" | "severity" | "temperature") => {
    if (part === "symptoms") {
      setStage("SYMPTOMS");
      add(
        "assistant",
        "What would you like to change? You can type a correction or select more symptoms.",
      );
      return;
    }
    const next = {
      ...intake,
      ...(part === "duration"
        ? { durationHours: undefined, severity: undefined, temperature: undefined }
        : {}),
      ...(part === "severity" ? { severity: undefined, temperature: undefined } : {}),
      ...(part === "temperature" ? { temperature: undefined } : {}),
    };
    const nextStage =
      part === "duration" ? "DURATION" : part === "severity" ? "SEVERITY" : "TEMPERATURE";
    setIntake(next);
    setStage(nextStage);
    add("assistant", prompt(nextStage, next));
  };
  const submit = async () => {
    if (!intake.symptoms.length || !intake.durationHours || !intake.severity) return;
    setBusy(true);
    setError(false);
    try {
      const data = await api<Prediction>("/api/v1/patient/symptoms", {
        method: "POST",
        body: {
          symptoms: intake.symptoms,
          duration_hours: intake.durationHours,
          severity: intake.severity,
          temperature: intake.temperature,
        },
      });
      setResult(data);
      setStage("RESULT");
      add(
        "assistant",
        "I’ve processed the information you provided. Here is educational guidance from WaterWatch — it is not a diagnosis.",
      );
      onSubmitted?.();
    } catch {
      setError(true);
      add(
        "assistant",
        "I couldn’t complete the assessment right now. Your answers are still here, so you can try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const summary = useMemo(
    () => ({
      symptoms: intake.symptoms.map(label).join(", "),
      duration: intake.durationHours
        ? `${intake.durationHours < 24 ? intake.durationHours : Math.round(intake.durationHours / 24)} ${intake.durationHours < 24 ? "hours" : "days"}`
        : "Not provided",
      severity: intake.severity ? label(intake.severity) : "Not provided",
      temperature: intake.temperature == null ? "Not provided" : `${intake.temperature}°C`,
    }),
    [intake],
  );
  const reset = () => {
    setMessages([welcome]);
    setIntake({ symptoms: [] });
    setStage("SYMPTOMS");
    setResult(null);
    setError(false);
  };
  return (
    <Panel
      title="Health assistant"
      icon={<MessageCircleHeart className="h-4 w-4 text-sky-700" />}
      action={
        <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Private by design
        </span>
      }
    >
      <div className="mx-auto flex max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-muted/20">
        <div
          aria-live="polite"
          className="max-h-[480px] min-h-[330px] space-y-3 overflow-y-auto p-4 sm:p-5"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${m.role === "user" ? "rounded-br-sm bg-sky-700 text-white" : "rounded-tl-sm border border-sky-100 bg-sky-50 text-slate-700"}`}
              >
                {m.role === "assistant" && (
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-sky-800">
                    <Bot className="h-3.5 w-3.5" /> WaterWatch assistant
                  </span>
                )}
                {m.content}
              </div>
            </div>
          ))}
          {stage === "SYMPTOMS" && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                You can also select anything you’re experiencing:
              </p>
              <div className="flex flex-wrap gap-2">
                {SYMPTOMS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={intake.symptoms.includes(s)}
                    onClick={() =>
                      answer(label(s), { ...intake, symptoms: [...intake.symptoms, s] })
                    }
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-sky-50 disabled:border-sky-200 disabled:bg-sky-50"
                  >
                    {label(s)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {stage === "DURATION" && (
            <div className="flex flex-wrap gap-2">
              {[
                [3, "Less than 6 hours"],
                [12, "6–24 hours"],
                [48, "1–3 days"],
                [96, "More than 3 days"],
              ].map(([h, t]) => (
                <button
                  key={String(h)}
                  type="button"
                  onClick={() => answer(t as string, { ...intake, durationHours: h as number })}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-sky-50"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {stage === "SEVERITY" && (
            <div className="flex gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => answer(label(s), { ...intake, severity: s })}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-sky-50"
                >
                  {label(s)}
                </button>
              ))}
            </div>
          )}
          {stage === "TEMPERATURE" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => answer("I don’t know", { ...intake, temperature: null })}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-sky-50"
              >
                I don’t know
              </button>
              <button
                type="button"
                onClick={() => answer("I haven’t checked", { ...intake, temperature: null })}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-sky-50"
              >
                I haven’t checked
              </button>
            </div>
          )}
          {stage === "REVIEW" && (
            <div className="rounded-xl border border-sky-100 bg-white p-4 text-sm">
              <h3 className="font-semibold">Your health summary</h3>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Symptoms</dt>
                  <dd>{summary.symptoms}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Duration</dt>
                  <dd>{summary.duration}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Severity</dt>
                  <dd>{summary.severity}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Temperature</dt>
                  <dd>{summary.temperature}</dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-700 px-3.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}{" "}
                  Submit assessment
                </button>
                <button
                  type="button"
                  onClick={() => edit("symptoms")}
                  className="rounded-lg border border-border px-3.5 text-sm"
                >
                  Edit answers
                </button>
              </div>
            </div>
          )}
          {busy && (
            <div className="text-xs text-muted-foreground">
              <Bot className="inline h-3.5 w-3.5" /> WaterWatch assistant{" "}
              <span className="animate-pulse">● ● ●</span>
            </div>
          )}
          {error && (
            <button
              type="button"
              onClick={submit}
              className="text-xs font-medium text-sky-700 hover:underline"
            >
              Retry assessment
            </button>
          )}
          {result && (
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm">
              <div className="flex justify-between gap-2">
                <h3 className="font-semibold">
                  Educational assessment: {label(result.predicted_disease)}
                </h3>
                <span className="text-xs">{Math.round(result.confidence * 100)}% confidence</span>
              </div>
              {result.precautions?.length ? (
                <ul className="mt-2 list-inside list-disc">
                  {result.precautions.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">
                {result.disclaimer ?? "Educational guidance only — not a diagnosis."}
              </p>
              <button
                type="button"
                onClick={reset}
                className="mt-3 inline-flex items-center gap-1 text-xs text-sky-700"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Start another assessment
              </button>
            </div>
          )}
          <div ref={bottom} />
        </div>
        <div className="border-t border-border bg-background p-3">
          <label className="sr-only" htmlFor="health-chat-composer">
            Describe what you’re experiencing
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="health-chat-composer"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={busy || stage === "RESULT"}
              rows={1}
              placeholder="Describe what you’re experiencing..."
              className="min-h-11 max-h-28 flex-1 resize-y rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 disabled:bg-muted"
            />
            <button
              type="button"
              aria-label="Send message"
              onClick={() => send()}
              disabled={!draft.trim() || busy || stage === "RESULT"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-sky-700 text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Enter to send · Shift+Enter for a new line · Conversation text is not stored.
          </p>
        </div>
      </div>
    </Panel>
  );
}
