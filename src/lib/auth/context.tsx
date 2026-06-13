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
import { getStoredUser, setSessionFlag, type SessionUser } from "./session";

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
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult>;
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
      // Dev fallback: restore any locally-stored mock session.
      setUser(getStoredUser());
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      const next = s?.user
        ? { id: s.user.id, label: s.user.phone || s.user.email || "Account" }
        : null;
      setUser(next);
      setSessionFlag(next);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user
        ? { id: session.user.id, label: session.user.phone || session.user.email || "Account" }
        : null;
      setUser(next);
      setSessionFlag(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // --- Dev fallback helper (no Supabase configured) --------------------------
  const devSignIn = useCallback((label: string): AuthResult => {
    const u: SessionUser = { id: `dev-${Date.now()}`, label };
    setUser(u);
    setSessionFlag(u);
    return { error: null };
  }, []);

  const signInWithPhone = useCallback<AuthContextValue["signInWithPhone"]>(
    async (phone) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: null }; // dev: skip OTP send, go straight to verify
      const { error } = await supabase.auth.signInWithOtp({ phone });
      return { error: error?.message ?? null };
    },
    [],
  );

  const verifyPhoneOtp = useCallback<AuthContextValue["verifyPhoneOtp"]>(
    async (phone, token) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return devSignIn(phone); // dev: accept any code
      const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
      return { error: error?.message ?? null };
    },
    [devSignIn],
  );

  const signInWithEmail = useCallback<AuthContextValue["signInWithEmail"]>(
    async (email, password) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return devSignIn(email);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    [devSignIn],
  );

  const signUpWithEmail = useCallback<AuthContextValue["signUpWithEmail"]>(
    async (email, password) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return devSignIn(email);
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error?.message ?? null };
    },
    [devSignIn],
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
