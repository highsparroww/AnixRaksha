export type ActivityLevel = "NORMAL" | "WATCH" | "ELEVATED" | "HIGH" | "CRITICAL";

export type MapCell = {
  cell_id: string;
  latitude: number;
  longitude: number;
  case_count: number;
  diseases: Record<string, number>;
  activity_level: ActivityLevel;
};

export type Notification = {
  id: string;
  title?: string;
  message?: string;
  body?: string;
  type?: string;
  is_read?: boolean;
  read?: boolean;
  created_at?: string;
};

export type OutbreakAlert = {
  id?: string;
  disease?: string;
  severity?: string;
  message?: string;
  description?: string;
  case_count?: number;
  radius_km?: number;
  detected_at?: string;
};

export type EnvironmentalRisk = {
  risk_level: string;
  risk_score: number;
  potential_water_borne_diseases: string[];
  potential_vector_borne_diseases: string[];
  contributing_factors: { factor: string; severity: string; reason: string }[];
  prevention_guidance: string[];
  data_status: string;
  assessed_at?: string;
  disclaimer?: string;
};

export type Prediction = {
  id?: string;
  prediction_id?: string;
  predicted_disease: string;
  is_water_borne: boolean;
  confidence: number;
  model_version?: string;
  precautions?: string[];
  disclaimer?: string;
  created_at?: string;
};

export type Appointment = {
  id?: string;
  appointment_id?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  doctor_name?: string;
  clinic_name?: string;
  reason?: string;
};

export type Slot = {
  id: string;
  start_time: string;
  end_time: string;
  is_booked?: boolean;
};

export type DiseaseActivity = {
  total_cases?: number;
  case_count?: number;
  growth_rate?: number;
  growth_percent?: number;
  activity_level?: ActivityLevel;
  radius_km?: number;
  time_window_days?: number;
};

export type Profile = {
  id?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  age?: number;
  gender?: string;
  latitude?: number;
  longitude?: number;
  specialization?: string;
  license_number?: string;
};

export type PatientDashboard = {
  profile?: Profile;
  disease_activity?: DiseaseActivity;
  rising_diseases?: { disease: string; growth_rate?: number; case_count?: number }[];
  outbreak_alerts?: OutbreakAlert[];
  map?: { cells?: MapCell[] };
  upcoming_appointments?: Appointment[];
  unread_notification_count?: number;
  notifications?: Notification[];
  nearby_clinics?: { id?: string; name?: string; distance_km?: number; address?: string }[];
  recent_predictions?: Prediction[];
};

export type DoctorCase = {
  id?: string;
  disease?: string;
  case_status?: string;
  reported_at?: string;
  symptom_onset?: string;
};

export type DoctorDashboard = {
  profile?: Profile;
  todays_appointments?: Appointment[];
  upcoming_appointments?: Appointment[];
  appointment_count?: number;
  recent_cases?: DoctorCase[];
  disease_activity?: DiseaseActivity;
  rising_diseases?: { disease: string; growth_rate?: number; case_count?: number }[];
  outbreak_alerts?: OutbreakAlert[];
  notifications?: Notification[];
  map?: { cells?: MapCell[] };
  available_slots?: Slot[];
};

export const SYMPTOMS = [
  "DIARRHEA",
  "VOMITING",
  "FEVER",
  "ABDOMINAL_PAIN",
  "DEHYDRATION",
  "NAUSEA",
  "BLOOD_IN_STOOL",
  "HEADACHE",
  "WEAKNESS",
  "MUSCLE_CRAMPS",
] as const;

export const DISEASES = [
  "CHOLERA",
  "TYPHOID",
  "HEPATITIS_A",
  "HEPATITIS_E",
  "DYSENTERY",
  "ROTAVIRUS",
  "OTHER_WATER_BORNE",
] as const;

export const CASE_STATUSES = [
  "SUSPECTED",
  "PROBABLE",
  "CONFIRMED",
  "RECOVERED",
  "REJECTED",
] as const;

export const SEVERITIES = ["MILD", "MODERATE", "SEVERE"] as const;

export const DEFAULT_CENTER = { latitude: 26.4499, longitude: 80.3319 };

export function label(value?: string | null) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type Outbreak = {
  id?: string;
  disease?: string;
  center_latitude?: number;
  center_longitude?: number;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  radius_km?: number;
  severity?: string;
  case_count?: number;
  growth_rate?: number;
  message?: string;
  prevention_guidance?: string[];
  detected_at?: string;
};

export type Clinic = {
  id?: string;
  name?: string;
  clinic_type?: string;
  type?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  opening_hours?: string;
  phone?: string;
};

export type NearbySurveillance = {
  total_cases?: number;
  case_count?: number;
  radius_km?: number;
  time_window_days?: number;
  growth_rate?: number;
  growth_percent?: number;
  activity_level?: ActivityLevel;
  cases_by_status?: Record<string, number>;
  confirmed_cases?: number;
  probable_cases?: number;
  suspected_cases?: number;
  cases_by_disease?: Record<string, number>;
};
