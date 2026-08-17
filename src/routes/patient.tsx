import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Activity, CalendarClock, Hospital, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { DEFAULT_CENTER, label } from "@/lib/types";
import type { EnvironmentalRisk, MapCell, PatientDashboard } from "@/lib/types";
import { Header } from "@/components/Header";
import { Panel, EmptyText, Row } from "@/components/Panel";
import { ActivityBadge } from "@/components/ActivityBadge";
import { SurveillanceMap } from "@/components/map/SurveillanceMap";
import { SymptomChecker } from "@/components/SymptomChecker";
import { EnvironmentalRiskPanel } from "@/components/EnvironmentalRiskPanel";

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
  const [risk, setRisk] = useState<EnvironmentalRisk | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.latitude, center.longitude, disease, days, radiusKm]);

  useEffect(() => {
    if (allowed) void loadDashboard();
  }, [allowed, loadDashboard]);

  useEffect(() => {
    if (!allowed) return;
    getEnvironmentalRisk()
      .then(setRisk)
      .catch(() => setRisk(null));
  }, [allowed]);

  useEffect(() => {
    if (allowed && dashboard) void loadMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, disease, days, radiusKm, dashboard?.profile?.latitude]);


  useRealtime(
    useCallback(
      (event) => {
        if (event.type === "SURVEILLANCE_UPDATED" || event.type === "NEW_CASE") {
          void loadMap();
        } else if (event.type === "OUTBREAK_ALERT") {
          toast.warning("New outbreak alert in your area");
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
  const growth = activity?.growth_rate ?? activity?.growth_percent;
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

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
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

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Local disease risk</div>
            <div className="mt-1.5">
              <ActivityBadge level={activity?.activity_level ?? "NORMAL"} />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Cases nearby
            </div>
            <div className="mt-1 text-xl font-semibold">{cases}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Growth
            </div>
            <div className="mt-1 text-xl font-semibold">
              {growth === undefined || growth === null ? "—" : `${Math.round(growth)}%`}
            </div>
          </div>
        </section>

        <SurveillanceMap
          cells={cells}
          center={center}
          disease={disease}
          onDiseaseChange={setDisease}
          days={days}
          onDaysChange={setDays}
          onCenter={loadMap}
          loading={mapLoading}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <EnvironmentalRiskPanel risk={risk} />
          <SymptomChecker onSubmitted={loadDashboard} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Recent prediction" icon={<Activity className="h-4 w-4 text-muted-foreground" />}>
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
                sub={fmtDate(appointment.start_time)}
                right={label(appointment.status)}
              />
            ) : (
              <EmptyText>No upcoming appointments.</EmptyText>
            )}
          </Panel>

          <Panel title="Nearby clinics" icon={<Hospital className="h-4 w-4 text-muted-foreground" />}>
            {dashboard?.nearby_clinics?.length ? (
              <div>
                {dashboard.nearby_clinics.slice(0, 4).map((c, i) => (
                  <Row
                    key={c.id ?? i}
                    left={c.name ?? "Clinic"}
                    sub={c.address}
                    right={c.distance_km !== undefined ? `${c.distance_km.toFixed(1)} km` : undefined}
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
