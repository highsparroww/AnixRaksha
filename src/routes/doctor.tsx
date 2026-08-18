import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, ClipboardList, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { CASE_STATUSES, DEFAULT_CENTER, DISEASES, SYMPTOMS, label } from "@/lib/types";
import type { DoctorDashboard, MapCell } from "@/lib/types";
import { Header } from "@/components/Header";
import { EmptyText, Panel, Row } from "@/components/Panel";
import { SurveillanceMap } from "@/components/map/SurveillanceMap";

export const Route = createFileRoute("/doctor")({
  head: () => ({
    meta: [
      { title: "Clinician Dashboard — WaterWatch" },
      {
        name: "description",
        content:
          "Register disease cases, monitor local surveillance activity and manage appointment slots.",
      },
      { property: "og:title", content: "Clinician Dashboard — WaterWatch" },
      {
        property: "og:description",
        content: "Case registration, outbreak alerts and a live water-borne disease map.",
      },
    ],
  }),
  component: DoctorPage,
});

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "mb-1 block text-xs text-muted-foreground";

function fmtDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function DoctorPage() {
  const allowed = useRequireRole("DOCTOR");
  const [dashboard, setDashboard] = useState<DoctorDashboard | null>(null);
  const [cells, setCells] = useState<MapCell[]>([]);
  const [days, setDays] = useState(7);
  const [mapLoading, setMapLoading] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);

  const profile = dashboard?.profile;
  const center = {
    latitude: profile?.latitude ?? DEFAULT_CENTER.latitude,
    longitude: profile?.longitude ?? DEFAULT_CENTER.longitude,
  };

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api<DoctorDashboard>("/api/v1/doctor/dashboard");
      setDashboard(data);
      if (data.map?.cells) setCells(data.map.cells);
    } catch {
      /* toast already shown */
    }
  }, []);

  const loadMap = useCallback(async () => {
    setMapLoading(true);
    try {
      const data = await api<{ cells: MapCell[] }>("/api/v1/surveillance/map", {
        query: {
          latitude: center.latitude,
          longitude: center.longitude,
          radius_km: 10,
          time_window_days: days,
        },
        silent: true,
      });
      setCells(data.cells ?? []);
    } catch {
      /* keep previous cells */
    } finally {
      setMapLoading(false);
    }
  }, [center.latitude, center.longitude, days]);

  useEffect(() => {
    if (allowed) void loadDashboard();
  }, [allowed, loadDashboard]);

  useEffect(() => {
    if (allowed && dashboard) void loadMap();
  }, [allowed, dashboard, loadMap]);

  useRealtime(
    useCallback(
      (event) => {
        if (event.type === "SURVEILLANCE_UPDATED" || event.type === "NEW_CASE") {
          void loadMap();
        } else if (event.type === "OUTBREAK_ALERT") {
          toast.warning("New outbreak alert in your catchment area");
          void loadDashboard();
        } else if (event.type === "APPOINTMENT_BOOKED" || event.type === "NOTIFICATION") {
          void loadDashboard();
        }
      },
      [loadMap, loadDashboard],
    ),
    allowed,
  );

  if (!allowed) return null;

  const alerts = dashboard?.outbreak_alerts ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header
        name={profile?.full_name}
        notifications={dashboard?.notifications ?? []}
        unreadCount={
          (dashboard?.notifications ?? []).filter((n) => !(n.is_read ?? n.read ?? false)).length
        }
        onRefresh={loadDashboard}
      />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        <section className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-indigo-100 bg-[linear-gradient(125deg,#f4f7ff,#fbfcff_58%,#f0fdfa)] px-5 py-4 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-indigo-700">
              Clinician workspace
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {profile?.full_name ?? "Community surveillance"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Record cases, manage availability, and watch for local signals.
            </p>
          </div>
          <div className="rounded-lg border border-indigo-100 bg-white/85 px-3 py-2 text-xs text-slate-600">
            Data is aggregated to protect patient privacy.
          </div>
        </section>
        {alerts.length > 0 ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <div className="text-sm">
                <span className="font-medium">
                  {alerts.length} active outbreak alert{alerts.length === 1 ? "" : "s"}
                </span>
                <div className="text-xs text-muted-foreground">
                  {alerts
                    .slice(0, 2)
                    .map((a) => a.message ?? a.description ?? label(a.disease))
                    .join(" · ")}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Today's appointments"
            icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
            action={
              <span className="text-xs text-muted-foreground">
                {dashboard?.appointment_count ?? dashboard?.todays_appointments?.length ?? 0} total
              </span>
            }
          >
            {dashboard?.todays_appointments?.length ? (
              <div>
                {dashboard.todays_appointments.map((a, i) => (
                  <Row
                    key={a.id ?? a.appointment_id ?? i}
                    left={a.reason ?? "Consultation"}
                    sub={a.created_at ? `Booked ${fmtDate(a.created_at)}` : "Appointment request"}
                    right={label(a.status)}
                  />
                ))}
              </div>
            ) : (
              <EmptyText>No appointments today.</EmptyText>
            )}
          </Panel>

          <CaseRegistration
            open={caseOpen}
            setOpen={setCaseOpen}
            center={center}
            onCreated={() => {
              void loadDashboard();
              void loadMap();
            }}
          />
        </div>

        <SurveillanceMap
          cells={cells}
          center={center}
          days={days}
          onDaysChange={setDays}
          onCenter={loadMap}
          loading={mapLoading}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Recent cases"
            icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
          >
            {dashboard?.recent_cases?.length ? (
              <div>
                {dashboard.recent_cases.slice(0, 6).map((c, i) => (
                  <Row
                    key={c.id ?? i}
                    left={label(c.disease)}
                    sub={fmtDate(c.reported_at)}
                    right={label(c.case_status)}
                  />
                ))}
              </div>
            ) : (
              <EmptyText>No cases registered yet.</EmptyText>
            )}
          </Panel>

          <SlotsPanel slots={dashboard?.available_slots ?? []} onChanged={loadDashboard} />
        </div>
      </main>
    </div>
  );
}

function CaseRegistration({
  open,
  setOpen,
  center,
  onCreated,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  center: { latitude: number; longitude: number };
  onCreated: () => void;
}) {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api("/api/v1/doctor/cases", {
        method: "POST",
        body: {
          disease: form.get("disease"),
          case_status: form.get("case_status"),
          patient_id: null,
          age: Number(form.get("age")) || undefined,
          gender: form.get("gender"),
          latitude: Number(form.get("latitude")),
          longitude: Number(form.get("longitude")),
          clinic_id: null,
          symptoms,
          symptom_onset: form.get("symptom_onset")
            ? new Date(String(form.get("symptom_onset"))).toISOString()
            : undefined,
          notes: form.get("notes") || undefined,
          reported_at: new Date().toISOString(),
        },
      });
      toast.success("Case registered");
      setSymptoms([]);
      setOpen(false);
      onCreated();
    } catch {
      /* toast already shown */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Register case"
      icon={<Plus className="h-4 w-4 text-muted-foreground" />}
      action={
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
        >
          {open ? "Close" : "New case"}
        </button>
      }
    >
      {!open ? (
        <EmptyText>
          Register confirmed or suspected cases, including walk-in patients without an account.
        </EmptyText>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="disease">
                Disease
              </label>
              <select id="disease" name="disease" className={inputClass} defaultValue="CHOLERA">
                {DISEASES.map((d) => (
                  <option key={d} value={d}>
                    {label(d)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="case_status">
                Status
              </label>
              <select
                id="case_status"
                name="case_status"
                className={inputClass}
                defaultValue="CONFIRMED"
              >
                {CASE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="age">
                Age
              </label>
              <input id="age" name="age" type="number" min={0} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="gender">
                Gender
              </label>
              <select id="gender" name="gender" className={inputClass} defaultValue="FEMALE">
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="latitude">
                Latitude
              </label>
              <input
                id="latitude"
                name="latitude"
                type="number"
                step="0.0001"
                defaultValue={center.latitude}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="longitude">
                Longitude
              </label>
              <input
                id="longitude"
                name="longitude"
                type="number"
                step="0.0001"
                defaultValue={center.longitude}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <span className={labelClass}>Symptoms</span>
            <div className="flex flex-wrap gap-1.5">
              {SYMPTOMS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setSymptoms((prev) =>
                      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                    )
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    symptoms.includes(s)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {label(s)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="symptom_onset">
              Symptom onset
            </label>
            <input
              id="symptom_onset"
              name="symptom_onset"
              type="datetime-local"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="notes">
              Notes
            </label>
            <input id="notes" name="notes" className={inputClass} />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save case
          </button>
        </form>
      )}
    </Panel>
  );
}

function SlotsPanel({
  slots,
  onChanged,
}: {
  slots: { id: string; start_time: string; end_time: string; status?: string }[];
  onChanged: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);

  const addSlot = async () => {
    if (!start || !end) return;
    setBusy(true);
    try {
      await api("/api/v1/doctor/slots", {
        method: "POST",
        body: {
          start_time: new Date(start).toISOString(),
          end_time: new Date(end).toISOString(),
        },
      });
      setStart("");
      setEnd("");
      onChanged();
    } catch {
      /* toast already shown */
    } finally {
      setBusy(false);
    }
  };

  const removeSlot = async (id: string) => {
    try {
      await api(`/api/v1/doctor/slots/${id}`, { method: "DELETE" });
      onChanged();
    } catch {
      /* toast already shown */
    }
  };

  return (
    <Panel
      title="Available slots"
      icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <label className={labelClass} htmlFor="slot-start">
            Start
          </label>
          <input
            id="slot-start"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="min-w-40 flex-1">
          <label className={labelClass} htmlFor="slot-end">
            End
          </label>
          <input
            id="slot-end"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={inputClass}
          />
        </div>
        <button
          type="button"
          onClick={addSlot}
          disabled={busy}
          className="h-9 rounded-md border border-border px-3 text-sm hover:bg-accent disabled:opacity-60"
        >
          Add
        </button>
      </div>

      {slots.length === 0 ? (
        <EmptyText>No slots published.</EmptyText>
      ) : (
        <div>
          {slots.map((s) => (
            <Row
              key={s.id}
              left={fmtDate(s.start_time)}
              sub={`until ${fmtDate(s.end_time)}`}
              right={
                s.status && s.status !== "AVAILABLE" ? (
                  label(s.status)
                ) : (
                  <button
                    type="button"
                    onClick={() => removeSlot(s.id)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                )
              }
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
