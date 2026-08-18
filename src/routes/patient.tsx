import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Activity,
  CalendarClock,
  Hospital,
  MapPin,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { DEFAULT_CENTER, label } from "@/lib/types";
import type { Clinic, MapCell, NearbySurveillance, Outbreak, PatientDashboard } from "@/lib/types";
import {
  getNearbyClinics,
  getNearbySurveillance,
  getOutbreaks,
  getSurveillanceMap,
} from "@/lib/surveillance";
import { Header } from "@/components/Header";
import { Panel, EmptyText, Row } from "@/components/Panel";
import { ActivityBadge } from "@/components/ActivityBadge";
import { SurveillanceMap } from "@/components/map/SurveillanceMap";
import { SymptomChecker } from "@/components/SymptomChecker";

export const Route = createFileRoute("/patient")({
  head: () => ({
    meta: [
      { title: "Patient Dashboard — WaterWatch" },
      {
        name: "description",
        content:
          "Track water-borne disease activity near you, review symptom checks and manage appointments.",
      },
      { property: "og:title", content: "Patient Dashboard — WaterWatch" },
      {
        property: "og:description",
        content: "Local disease risk, surveillance map and environmental conditions in one place.",
      },
    ],
  }),
  component: PatientPage,
});

function fmtDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function PatientPage() {
  const allowed = useRequireRole("PATIENT");
  const [dashboard, setDashboard] = useState<PatientDashboard | null>(null);
  const [cells, setCells] = useState<MapCell[]>([]);
  const [outbreaks, setOutbreaks] = useState<Outbreak[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [nearby, setNearby] = useState<NearbySurveillance | null>(null);
  const [disease, setDisease] = useState("");
  const [days, setDays] = useState(7);
  const [radiusKm, setRadiusKm] = useState(10);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState(false);

  const profile = dashboard?.profile;
  const center = {
    latitude: profile?.latitude ?? DEFAULT_CENTER.latitude,
    longitude: profile?.longitude ?? DEFAULT_CENTER.longitude,
  };

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api<PatientDashboard>("/api/v1/patient/dashboard");
      setDashboard(data);
      if (data.map?.cells) setCells(data.map.cells);
    } catch {
      /* toast already shown */
    }
  }, []);

  const loadMap = useCallback(async () => {
    setMapLoading(true);
    const geo = {
      latitude: center.latitude,
      longitude: center.longitude,
      radiusKm,
      disease: disease || undefined,
      timeWindowDays: days,
    };
    try {
      const data = await getSurveillanceMap(geo);
      setCells(data.cells ?? []);
      setMapError(false);
    } catch {
      setMapError(true);
    } finally {
      setMapLoading(false);
    }
    void getOutbreaks(geo)
      .then(setOutbreaks)
      .catch(() => setOutbreaks([]));
    void getNearbySurveillance(geo)
      .then(setNearby)
      .catch(() => setNearby(null));
    void getNearbyClinics(geo)
      .then(setClinics)
      .catch(() => setClinics([]));
  }, [center.latitude, center.longitude, disease, days, radiusKm]);

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
          toast.warning("New outbreak alert in your area");
          void loadMap();
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

  const activity = dashboard?.disease_activity;
  const cases = activity?.total_cases ?? activity?.case_count ?? 0;
  const growth = activity?.growth_percentage;
  const nearbyCases = nearby?.total_cases ?? cases;
  const alerts = dashboard?.outbreak_alerts ?? [];
  const appointment = dashboard?.upcoming_appointments?.[0];
  const prediction = dashboard?.recent_predictions?.[0];

  return (
    <div className="min-h-screen bg-background">
      <Header
        name={profile?.full_name}
        notifications={dashboard?.notifications ?? []}
        unreadCount={dashboard?.unread_notification_count ?? 0}
        onRefresh={loadDashboard}
      />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        <section className="rounded-2xl border border-sky-200/70 bg-[linear-gradient(125deg,#effaff_0%,#f8fcff_54%,#eefbf5_100%)] px-5 py-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-sky-800">
                <MapPin className="h-3.5 w-3.5" /> Your local health overview
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {profile?.full_name
                  ? `Hello, ${profile.full_name.split(" ")[0]}`
                  : "Stay informed, stay prepared"}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-slate-600">
                Monitor anonymised disease activity around you and record symptoms when you need
                guidance.
              </p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-white/80 px-3 py-2 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-medium text-slate-800">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Privacy protected
              </div>
              <div className="mt-0.5">Only area-level case data is shown</div>
            </div>
          </div>
        </section>
        {alerts.length > 0 ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <div className="text-sm">
                <span className="font-medium text-foreground">
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

        <SurveillanceMap
          cells={cells}
          center={center}
          disease={disease}
          onDiseaseChange={setDisease}
          days={days}
          onDaysChange={setDays}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          outbreaks={outbreaks}
          clinics={clinics}
          error={mapError}
          onRetry={loadMap}
          onCenter={loadMap}
          loading={mapLoading}
        />

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="text-xs text-muted-foreground">Local disease risk</div>
            <div className="mt-1.5">
              <ActivityBadge
                level={nearby?.activity_level ?? activity?.activity_level ?? "NORMAL"}
              />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Cases nearby
            </div>
            <div className="mt-1 text-xl font-semibold">{nearbyCases}</div>
            <div className="text-[11px] text-muted-foreground">within {radiusKm} km</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Growth
            </div>
            <div className="mt-1 text-xl font-semibold">
              {growth === undefined || growth === null
                ? "—"
                : `${growth > 0 ? "+" : ""}${Math.round(growth * 10) / 10}%`}
            </div>
            <div className="text-[11px] text-muted-foreground">vs previous period</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" /> Outbreaks
            </div>
            <div className="mt-1 text-xl font-semibold">{outbreaks.length || alerts.length}</div>
            <div className="text-[11px] text-muted-foreground">active in your area</div>
          </div>
        </section>

        <SymptomChecker onSubmitted={loadDashboard} />

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel
            title="Recent prediction"
            icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          >
            {prediction ? (
              <div className="space-y-1">
                <div className="text-sm font-medium">{label(prediction.predicted_disease)}</div>
                <div className="text-xs text-muted-foreground">
                  {Math.round((prediction.confidence ?? 0) * 100)}% confidence ·{" "}
                  {fmtDate(prediction.created_at)}
                </div>
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Automated estimate — not a confirmed medical diagnosis.
                </p>
              </div>
            ) : (
              <EmptyText>No symptom checks yet.</EmptyText>
            )}
          </Panel>

          <Panel
            title="Upcoming appointment"
            icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
          >
            {appointment ? (
              <Row
                left={appointment.doctor_name ?? appointment.clinic_name ?? "Appointment"}
                sub={
                  appointment.created_at
                    ? `Requested ${fmtDate(appointment.created_at)}`
                    : "Appointment request"
                }
                right={label(appointment.status)}
              />
            ) : (
              <EmptyText>No upcoming appointments.</EmptyText>
            )}
          </Panel>

          <Panel
            title="Nearby clinics"
            icon={<Hospital className="h-4 w-4 text-muted-foreground" />}
          >
            {dashboard?.nearby_clinics?.length ? (
              <div>
                {dashboard.nearby_clinics.slice(0, 4).map((c, i) => (
                  <Row
                    key={c.id ?? i}
                    left={c.name ?? "Clinic"}
                    sub={c.address}
                    right={
                      c.distance_km !== undefined ? `${c.distance_km.toFixed(1)} km` : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyText>No clinics found nearby.</EmptyText>
            )}
          </Panel>
        </div>
      </main>
    </div>
  );
}
