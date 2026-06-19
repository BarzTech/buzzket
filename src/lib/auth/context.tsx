import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "../supabase/client";
import { setSessionFlag, type SessionUser } from "./session";

type AuthResult = { error: string | null };

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  supabaseEnabled: boolean;
  // Phone (OTP) — the default method.
  signInWithPhone: (phone: string) => Promise<AuthResult>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<AuthResult>;
  // Email / password.
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (
    email: string,
    password: string,
    role?: SessionUser["role"],
  ) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromSession(session: Session | null): SessionUser | null {
  const sessionUser = session?.user;
  if (!sessionUser) return null;

  return {
    id: sessionUser.id,
    label: sessionUser.phone || sessionUser.email || "Account",
    role: (sessionUser.user_metadata?.role as SessionUser["role"] | undefined) ?? "buyer",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabaseEnabled = isSupabaseConfigured();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setSessionFlag(null);
      setUser(null);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      const next = userFromSession(data.session);
      setUser(next);
      setSessionFlag(next);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = userFromSession(session);
      setUser(next);
      setSessionFlag(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);


  const signInWithPhone = useCallback<AuthContextValue["signInWithPhone"]>(
    async (phone) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: "Supabase is not configured. Add the launch environment variables first." };
      const cleanPhone = phone.replace(/[^\d+]/g, "");
      const { error } = await supabase.auth.signInWithOtp({ phone: cleanPhone });
      return { error: error?.message ?? null };
    },
    [],
  );

  const verifyPhoneOtp = useCallback<AuthContextValue["verifyPhoneOtp"]>(
    async (phone, token) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: "Supabase is not configured. Add the launch environment variables first." };
      const cleanPhone = phone.replace(/[^\d+]/g, "");
      const { data, error } = await supabase.auth.verifyOtp({ phone: cleanPhone, token, type: "sms" });
      const next = userFromSession(data.session);
      setUser(next);
      setSessionFlag(next);
      return { error: error?.message ?? null };
    },
    [],
  );

  const signInWithEmail = useCallback<AuthContextValue["signInWithEmail"]>(
    async (email, password) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: "Supabase is not configured. Add the launch environment variables first." };
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      const next = userFromSession(data.session);
      setUser(next);
      setSessionFlag(next);
      return { error: error?.message ?? null };
    },
    [],
  );

  const signUpWithEmail = useCallback<AuthContextValue["signUpWithEmail"]>(
    async (email, password, role = "buyer") => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: "Supabase is not configured. Add the launch environment variables first." };
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { role } },
      });
      const next = userFromSession(data.session);
      setUser(next);
      setSessionFlag(next);
      return { error: error?.message ?? null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setSessionFlag(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      supabaseEnabled,
      signInWithPhone,
      verifyPhoneOtp,
      signInWithEmail,
      signUpWithEmail,
      signOut,
    }),
    [user, loading, supabaseEnabled, signInWithPhone, verifyPhoneOtp, signInWithEmail, signUpWithEmail, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
