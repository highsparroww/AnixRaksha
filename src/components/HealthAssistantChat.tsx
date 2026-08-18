import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Loader2, MessageCircleHeart, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { SEVERITIES, SYMPTOMS, label } from "@/lib/types";
import type { Prediction } from "@/lib/types";
import { Panel } from "@/components/Panel";

type Conversation = {
  id: string;
  health_intake_id: string;
  status: string;
  health_intake: Record<string, unknown>;
};

type Suggestions = {
  suggestions: { symptom: string; related_diseases: string[]; reason: string }[];
  local_diseases: string[];
  disclaimer: string;
};

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-sky-500/30";

export function HealthAssistantChat({ onSubmitted }: { onSubmitted?: (() => void) | undefined }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [duration, setDuration] = useState(24);
  const [severity, setSeverity] = useState("MODERATE");
  const [temperature, setTemperature] = useState("");
  const [notes, setNotes] = useState("");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [shareSummary, setShareSummary] = useState(false);

  useEffect(() => {
    api<Suggestions>("/api/v1/patient/symptom-suggestions", { silent: true })
      .then(setSuggestions)
      .catch(() => setSuggestions(null));
  }, []);

  const highlightedSymptoms = useMemo(
    () => new Set(suggestions?.suggestions.map((item) => item.symptom) ?? []),
    [suggestions],
  );

  const toggle = (symptom: string) => {
    setSelected((current) =>
      current.includes(symptom)
        ? current.filter((item) => item !== symptom)
        : [...current, symptom],
    );
  };

  const intake = () => ({
    symptoms: selected,
    duration_hours: duration,
    severity,
    temperature: temperature ? Number(temperature) : null,
    notes: notes || null,
    share_with_clinician: shareSummary,
  });

  const persistIntake = async () => {
    let current = conversation;
    if (!current) {
      current = await api<Conversation>("/api/v1/patient/health-conversations", {
        method: "POST",
        body: { structured_data: intake() },
      });
    } else {
      current = await api<Conversation>(
        `/api/v1/patient/health-conversations/${current.id}/intake`,
        {
          method: "PATCH",
          body: {
            structured_data: intake(),
            summary: `${selected.length} symptom${selected.length === 1 ? "" : "s"} reported for ${duration} hours.`,
          },
        },
      );
    }
    setConversation(current);
    return current;
  };

  const saveIntake = async () => {
    if (!selected.length) {
      toast.error("Choose at least one symptom to save your health summary.");
      return;
    }
    setBusy(true);
    try {
      await persistIntake();
      toast.success("Health summary saved privately.");
    } catch {
      // API client displays the error.
    } finally {
      setBusy(false);
    }
  };

  const getGuidance = async () => {
    if (!selected.length) {
      toast.error("Choose at least one symptom first.");
      return;
    }
    setBusy(true);
    try {
      await persistIntake();
      const prediction = await api<Prediction>("/api/v1/patient/symptoms", {
        method: "POST",
        body: intake(),
      });
      setResult(prediction);
      onSubmitted?.();
    } catch {
      // API client displays the error.
    } finally {
      setBusy(false);
    }
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
      className="overflow-hidden"
    >
      <div className="space-y-4">
        <div className="max-w-2xl rounded-2xl rounded-tl-sm bg-sky-50 px-3.5 py-3 text-sm text-slate-700">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-sky-800">
            <Bot className="h-3.5 w-3.5" /> WaterWatch assistant
          </div>
          Tell me what you are experiencing. I can help you record a structured health summary and
          provide educational guidance — not a diagnosis.
        </div>

        {suggestions?.suggestions.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            <span className="font-semibold">Local health signal:</span> Some symptoms below are
            highlighted because of nearby public-health activity. This is not a diagnosis.
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            Which symptoms are you experiencing?
          </p>
          <div className="flex flex-wrap gap-2">
            {SYMPTOMS.map((symptom) => {
              const active = selected.includes(symptom);
              const suggested = highlightedSymptoms.has(symptom);
              return (
                <button
                  key={symptom}
                  type="button"
                  onClick={() => toggle(symptom)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-sky-700 bg-sky-700 text-white"
                      : suggested
                        ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                        : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {label(symptom)}
                </button>
              );
            })}
          </div>
          {step === 1 ? (
            <button
              type="button"
              onClick={() =>
                selected.length ? setStep(2) : toast.error("Choose a symptom to continue.")
              }
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-sky-700 px-3.5 text-sm font-medium text-white hover:bg-sky-800"
            >
              Continue <Send className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {step >= 2 ? (
          <>
            <div className="max-w-2xl rounded-2xl rounded-tl-sm bg-sky-50 px-3.5 py-3 text-sm text-slate-700">
              Thanks — I have noted {selected.map(label).join(", ")}. How long have you felt this
              way, and how severe does it feel?
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-muted-foreground">
                Duration (hours)
                <input
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Severity
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value)}
                  className={`${inputClass} mt-1`}
                >
                  {SEVERITIES.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Temperature (°C)
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(event) => setTemperature(event.target.value)}
                  className={`${inputClass} mt-1`}
                  placeholder="Optional"
                />
              </label>
            </div>

            {step === 2 ? (
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-700 px-3.5 text-sm font-medium text-white hover:bg-sky-800"
              >
                Continue <Send className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </>
        ) : null}

        {step >= 3 ? (
          <>
            <div className="max-w-2xl rounded-2xl rounded-tl-sm bg-sky-50 px-3.5 py-3 text-sm text-slate-700">
              Almost done. You can add a note, then decide whether to save your summary or submit it
              for educational guidance.
            </div>
            <label className="block text-xs font-medium text-muted-foreground">
              Anything else you want to add?
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="mt-1.5 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-shadow focus:ring-2 focus:ring-sky-500/30"
                placeholder="Optional notes — only your structured summary is saved."
              />
            </label>

            <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={shareSummary}
                onChange={(event) => setShareSummary(event.target.checked)}
                className="mt-0.5 accent-sky-700"
              />
              <span>
                <span className="font-medium text-foreground">
                  Make this summary available for a future appointment.
                </span>{" "}
                Only the structured summary is eligible for sharing; this temporary chat
                conversation is never stored as a transcript.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveIntake}
                disabled={busy || !selected.length}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {conversation ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null} Save
                summary
              </button>
              <button
                type="button"
                onClick={getGuidance}
                disabled={busy || !selected.length}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-700 px-4 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{" "}
                Get guidance
              </button>
              {conversation ? (
                <span className="text-xs text-emerald-700">
                  Structured summary saved — no chat transcript is stored.
                </span>
              ) : null}
            </div>

            {result ? (
              <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    Educational guidance: {label(result.predicted_disease)}
                  </span>
                  <span className="text-xs text-slate-600">
                    {Math.round(result.confidence * 100)}% model confidence
                  </span>
                </div>
                {result.precautions?.length ? (
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
                    {result.precautions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 text-xs text-slate-600">
                  {result.disclaimer ??
                    "This is an educational estimate, not a confirmed diagnosis. Seek professional care for concerning symptoms."}
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Panel>
  );
}
