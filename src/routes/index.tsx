import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Droplets, Loader2, LocateFixed } from "lucide-react";
import { api } from "@/lib/api";
import { homeForRole, useAuth, type Role } from "@/lib/auth";
import { DEFAULT_CENTER } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WaterWatch — Water-borne Disease Surveillance" },
      {
        name: "description",
        content:
          "Sign in to WaterWatch to monitor local water-borne disease activity, check symptoms and manage clinical cases.",
      },
      { property: "og:title", content: "WaterWatch — Water-borne Disease Surveillance" },
      {
        property: "og:description",
        content:
          "Community disease surveillance for patients and clinicians: live activity map, alerts and symptom checks.",
      },
    ],
  }),
  component: AuthPage,
});

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

type LoginData = { access_token: string; token_type: string; role: Role; user_id: string };

function AuthPage() {
  const { ready, token, role, signIn } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [formRole, setFormRole] = useState<Role>("PATIENT");
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState(DEFAULT_CENTER);

  useEffect(() => {
    if (ready && token) void navigate({ to: homeForRole(role) });
  }, [ready, token, role, navigate]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) =>
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
    );
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      if (mode === "register") {
        const body: Record<string, unknown> = {
          role: formRole,
          full_name: form.get("full_name"),
          email: form.get("email"),
          password: form.get("password"),
          phone: form.get("phone"),
          age: Number(form.get("age")) || undefined,
          gender: form.get("gender"),
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        if (formRole === "DOCTOR") {
          body["specialization"] = form.get("specialization") || undefined;
          body["license_number"] = form.get("license_number") || undefined;
        }
        await api("/api/v1/auth/register", { method: "POST", body, auth: false });
      }

      const data = await api<LoginData>("/api/v1/auth/login", {
        method: "POST",
        auth: false,
        body: { email: form.get("email"), password: form.get("password") },
      });
      signIn(data.access_token, data.role);
      void navigate({ to: homeForRole(data.role) });
    } catch {
      /* toast already shown */
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <Droplets className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">WaterWatch</h1>
            <p className="text-xs text-muted-foreground">Water-borne disease surveillance</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-sm">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-sm py-1.5 ${
                  mode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "login" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" ? (
              <>
                <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-1 text-xs">
                  {(["PATIENT", "DOCTOR"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormRole(r)}
                      className={`rounded-sm py-1.5 ${
                        formRole === r
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {r === "PATIENT" ? "Patient" : "Doctor"}
                    </button>
                  ))}
                </div>

                <div>
                  <label className={labelClass} htmlFor="full_name">
                    Full name
                  </label>
                  <input id="full_name" name="full_name" required className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="phone">
                      Phone
                    </label>
                    <input id="phone" name="phone" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="age">
                      Age
                    </label>
                    <input id="age" name="age" type="number" min={0} className={inputClass} />
                  </div>
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
                {formRole === "DOCTOR" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass} htmlFor="specialization">
                        Specialization
                      </label>
                      <input id="specialization" name="specialization" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="license_number">
                        License no.
                      </label>
                      <input id="license_number" name="license_number" className={inputClass} />
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={useMyLocation}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <LocateFixed className="h-3.5 w-3.5" />
                  Use my location ({coords.latitude.toFixed(3)}, {coords.longitude.toFixed(3)})
                </button>
              </>
            ) : null}

            <div>
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
