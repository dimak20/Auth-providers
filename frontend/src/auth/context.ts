import { createContext, useContext } from "react";
import type { ProviderId } from "./registry";

export type AuthUser = {
  email: string | null;
  name: string | null;
};

export type RedirectLoginOptions = {
  signup?: boolean;
  google?: boolean;
  /** Corporate SSO: the work email lets the provider pick the company's identity provider. */
  sso?: { email: string };
  returnTo?: string;
};

/** What the app needs from any auth provider. Each provider adapts its SDK to this. */
export type AuthApi = {
  provider: ProviderId;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  error: string | null;
  supports: {
    /** Provider has its own hosted login page (Auth0 Universal Login). */
    hostedLogin: boolean;
    /** Login form with email + password lives in our app (Supabase). */
    password: boolean;
    google: boolean;
    /** "Sign in with SSO" through a corporate identity provider. */
    sso: boolean;
  };
  getAccessToken: () => Promise<string>;
  loginWithRedirect: (options?: RedirectLoginOptions) => Promise<void>;
  signInWithPassword?: (email: string, password: string) => Promise<void>;
  signUpWithPassword?: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an auth provider");
  return ctx;
}
