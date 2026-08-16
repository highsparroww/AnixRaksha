import { useState } from "react";
import { Loader2, Stethoscope } from "lucide-react";
import { api } from "@/lib/api";
import { SEVERITIES, SYMPTOMS, label } from "@/lib/types";
import type { Prediction } from "@/lib/types";
import { Panel } from "@/components/Panel";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

export function SymptomChecker({ onSubmitted }: { onSubmitted?: (() => void) | undefined }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [severity, setSeverity] = useState("MODERATE");
  const [duration, setDuration] = useState(24);
  const [temperature, setTemperature] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);

  const toggle = (symptom: string) =>
    setSelected((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom],
    );

  const submit = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const data = await api<Prediction>("/api/v1/patient/symptoms", {
        method: "POST",
        body: {
          symptoms: selected,
          duration_hours: duration,
          temperature: temperature ? Number(temperature) : undefined,
          severity,
          notes: notes || undefined,
        },
      });
      setResult(data);
      onSubmitted?.();
    } catch {
      /* toast already shown */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Symptom check" icon={<Stethoscope className="h-4 w-4 text-muted-foreground" />}>
      <div className="flex flex-wrap gap-1.5">
        {SYMPTOMS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              selected.includes(s)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {label(s)}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground" htmlFor="severity">
            Severity
          </label>
          <select
            id="severity"
            className={inputClass}
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground" htmlFor="duration">
            Duration (h)
          </label>
          <input
            id="duration"
            type="number"
            min={1}
            className={inputClass}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground" htmlFor="temperature">
            Temp (°C)
          </label>
          <input
            id="temperature"
            type="number"
            step="0.1"
            className={inputClass}
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
        </div>
      </div>

      <input
        className={`${inputClass} mt-3`}
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <button
        type="button"
        onClick={submit}
        disabled={busy || selected.length === 0}
        className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Check symptoms
      </button>

      {result ? (
        <div className="mt-4 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{label(result.predicted_disease)}</span>
            <span className="text-xs text-muted-foreground">
              {Math.round((result.confidence ?? 0) * 100)}% confidence
              {result.is_water_borne ? " · water-borne" : ""}
            </span>
          </div>
          {result.precautions?.length ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
              {result.precautions.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
            {result.disclaimer ??
              "This is an automated estimate, not a confirmed medical diagnosis. Consult a clinician."}
          </p>
        </div>
      ) : null}
    </Panel>
  );
}
