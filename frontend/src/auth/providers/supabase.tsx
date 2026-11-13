import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { config } from "../../config";
import { type AuthApi, AuthContext, type RedirectLoginOptions } from "../context";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  client ??= createClient(config.supabase.url, config.supabase.key, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

/** OAuth failures come back as ?error_description=... (or in the hash). */
function readUrlError(): string | null {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return query.get("error_description") ?? hash.get("error_description");
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const supabase = getClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(readUrlError);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      setSession(data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const getAccessToken = useCallback(async () => {
    // getSession() refreshes the token first if it has expired
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error("Not signed in");
    return data.session.access_token;
  }, [supabase]);

  const loginWithRedirect = useCallback(
    async ({ google }: RedirectLoginOptions = {}) => {
      if (!google) throw new Error("Supabase has no hosted login page, use the form instead.");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    },
    [supabase],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    [supabase],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      // no session means "Confirm email" is on and the user has to click the link first
      return { needsConfirmation: !data.session };
    },
    [supabase],
  );

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [supabase]);

  const value = useMemo<AuthApi>(
    () => ({
      provider: "supabase",
      isLoading,
      isAuthenticated: session !== null,
      user: session
        ? {
            email: session.user.email ?? null,
            name: (session.user.user_metadata?.full_name as string | undefined) ?? null,
          }
        : null,
      error,
      supports: { hostedLogin: false, password: true, google: true, sso: false },
      getAccessToken,
      loginWithRedirect,
      signInWithPassword,
      signUpWithPassword,
      logout,
    }),
    [
      isLoading,
      session,
      error,
      getAccessToken,
      loginWithRedirect,
      signInWithPassword,
      signUpWithPassword,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
