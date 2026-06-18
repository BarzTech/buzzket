import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
      const s = data.session;
      const next = s?.user
        ? {
            id: s.user.id,
            label: s.user.phone || s.user.email || "Account",
            role: (s.user.user_metadata?.role as SessionUser["role"] | undefined) ?? "buyer",
          }
        : null;
      setUser(next);
      setSessionFlag(next);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user
        ? {
            id: session.user.id,
            label: session.user.phone || session.user.email || "Account",
            role: (session.user.user_metadata?.role as SessionUser["role"] | undefined) ?? "buyer",
          }
        : null;
      setUser(next);
      setSessionFlag(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);


  const signInWithPhone = useCallback<AuthContextValue["signInWithPhone"]>(
    async (phone) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: "Supabase is not configured. Add the launch environment variables first." };
      const { error } = await supabase.auth.signInWithOtp({ phone });
      return { error: error?.message ?? null };
    },
    [],
  );

  const verifyPhoneOtp = useCallback<AuthContextValue["verifyPhoneOtp"]>(
    async (phone, token) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: "Supabase is not configured. Add the launch environment variables first." };
      const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
      return { error: error?.message ?? null };
    },
    [],
  );

  const signInWithEmail = useCallback<AuthContextValue["signInWithEmail"]>(
    async (email, password) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: "Supabase is not configured. Add the launch environment variables first." };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    [],
  );

  const signUpWithEmail = useCallback<AuthContextValue["signUpWithEmail"]>(
    async (email, password, role = "buyer") => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: "Supabase is not configured. Add the launch environment variables first." };
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role } },
      });
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
