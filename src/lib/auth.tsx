import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ROLE_KEY, TOKEN_KEY, clearSession } from "./api";

export type Role = "PATIENT" | "DOCTOR" | "ADMIN";

type AuthState = {
  ready: boolean;
  token: string | null;
  role: Role | null;
  signIn: (token: string, role: Role) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setToken(window.localStorage.getItem(TOKEN_KEY));
    setRole(window.localStorage.getItem(ROLE_KEY) as Role | null);
    setReady(true);
  }, []);

  const signIn = useCallback((t: string, r: Role) => {
    window.localStorage.setItem(TOKEN_KEY, t);
    window.localStorage.setItem(ROLE_KEY, r);
    setToken(t);
    setRole(r);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setToken(null);
    setRole(null);
    void navigate({ to: "/" });
  }, [navigate]);

  const value = useMemo(
    () => ({ ready, token, role, signIn, signOut }),
    [ready, token, role, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function homeForRole(role: Role | null) {
  if (role === "DOCTOR") return "/doctor";
  if (role === "ADMIN") return "/admin";
  return "/patient";
}

/** Redirects to sign-in when there is no session, or away when the role mismatches. */
export function useRequireRole(expected: Role) {
  const { ready, token, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      void navigate({ to: "/" });
      return;
    }
    if (role && role !== expected) {
      void navigate({ to: homeForRole(role) });
    }
  }, [ready, token, role, expected, navigate]);

  return ready && !!token && role === expected;
}
