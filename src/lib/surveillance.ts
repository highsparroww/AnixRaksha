import { api } from "./api";
import type {
  Clinic,
  DiseaseActivity,
  Forecast,
  MapCell,
  NearbySurveillance,
  Outbreak,
  PatientDashboard,
  Profile,
} from "./types";

type Geo = {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  disease?: string | undefined;
  timeWindowDays?: number | undefined;
};

const geoQuery = (p: Geo) => ({
  latitude: p.latitude,
  longitude: p.longitude,
  radius_km: p.radiusKm,
  disease: p.disease || undefined,
  time_window_days: p.timeWindowDays,
});

export const getPatientProfile = () => api<Profile>("/api/v1/patient/me");

export const getPatientDashboard = () => api<PatientDashboard>("/api/v1/patient/dashboard");

export const getSurveillanceMap = (p: Geo) =>
  api<{ cells: MapCell[] }>("/api/v1/surveillance/map", { query: geoQuery(p), silent: true });

export const getForecastMap = () =>
  api<{ forecasts: Forecast[] }>("/api/v1/surveillance/forecast-map", { silent: true });

export const getNearbySurveillance = (p: Geo) =>
  api<NearbySurveillance>("/api/v1/surveillance/nearby", { query: geoQuery(p), silent: true });

export const getDiseaseActivity = (p: Geo) =>
  api<DiseaseActivity>("/api/v1/surveillance/activity", { query: geoQuery(p), silent: true });

export const getOutbreaks = (p: Geo & { activeOnly?: boolean }) =>
  api<{ outbreaks?: Outbreak[] } | Outbreak[]>("/api/v1/surveillance/outbreaks", {
    query: { ...geoQuery(p), active_only: p.activeOnly ?? true },
    silent: true,
  }).then((d) => (Array.isArray(d) ? d : (d.outbreaks ?? [])));

export const getNearbyClinics = (p: Geo) =>
  api<{ clinics?: Clinic[] } | Clinic[]>("/api/v1/clinics/nearby", {
    query: { latitude: p.latitude, longitude: p.longitude, radius_km: p.radiusKm },
    silent: true,
  }).then((d) => (Array.isArray(d) ? d : (d.clinics ?? [])));
