import { ErrorResponse, type User, UserManager, WebStorageStateStore } from "oidc-client-ts";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { errorMessage } from "../../api";
import { config } from "../../config";
import { type AuthApi, AuthContext, type RedirectLoginOptions } from "../context";

let manager: UserManager | null = null;

function getManager(): UserManager {
  manager ??= new UserManager({
    authority: `${config.keycloak.url}/realms/${config.keycloak.realm}`,
    client_id: config.keycloak.clientId,
    // trailing slash so it matches "http://localhost:5173/*" in Valid redirect URIs
    redirect_uri: `${window.location.origin}/`,
    post_logout_redirect_uri: `${window.location.origin}/`,
    response_type: "code",
    scope: "openid profile email",
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    automaticSilentRenew: true,
  });
  return manager;
}

/** Shared between StrictMode's double effect runs: a code can be exchanged only once. */
let callback: Promise<User> | null = null;

/**
 * signoutRedirect() removes the stored user before leaving the page. If the app saw that,
 * RequireAuth would start a new login whose redirect races the logout one and wins.
 */
let signingOut = false;

/** Don't hit the token endpoint on every focus event. */
const SESSION_CHECK_INTERVAL_MS = 5_000;

/** Home realm discovery: which company IdP owns this email's domain. */
function idpForEmail(email: string): string {
  const domain = email.split("@").pop()?.toLowerCase() ?? "";
  return config.keycloak.ssoDomains[domain] ?? config.keycloak.ssoIdp;
}

function isCallbackUrl(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has("state") && (params.has("code") || params.has("error"));
}

type LoginState = { returnTo?: string };

export function KeycloakAuthProvider({ children }: { children: ReactNode }) {
  const userManager = getManager();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const onLoaded = (u: User) => {
      if (active) setUser(u);
    };
    const onUnloaded = () => {
      if (active && !signingOut) setUser(null);
    };
    userManager.events.addUserLoaded(onLoaded);
    userManager.events.addUserUnloaded(onUnloaded);

    async function init() {
      try {
        if (isCallbackUrl()) {
          callback ??= userManager.signinRedirectCallback();
          const signedIn = await callback;
          if (!active) return;
          setUser(signedIn);
          const returnTo = (signedIn.state as LoginState | undefined)?.returnTo;
          navigate(returnTo ?? "/orders", { replace: true });
        } else {
          const stored = await userManager.getUser();
          if (active) setUser(stored);
        }
      } catch (e) {
        if (!active) return;
        setError(errorMessage(e));
        navigate("/", { replace: true });
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void init();
    return () => {
      active = false;
      userManager.events.removeUserLoaded(onLoaded);
      userManager.events.removeUserUnloaded(onUnloaded);
    };
  }, [userManager, navigate]);

  /**
   * Refreshes tokens with the refresh_token grant. Keycloak rejects it with invalid_grant
   * once the SSO session is over (e.g. the user logged out in another app of the realm),
   * so that's also how a logout elsewhere reaches this app.
   */
  const refresh = useCallback(async (): Promise<User | null> => {
    try {
      return await userManager.signinSilent();
    } catch (e) {
      if (e instanceof ErrorResponse && e.error === "invalid_grant") {
        await userManager.removeUser();
        return null;
      }
      throw e;
    }
  }, [userManager]);

  // Single logout across apps: re-check the SSO session when the tab gets focus again.
  useEffect(() => {
    let lastCheck = 0;

    async function checkSession() {
      if (document.visibilityState !== "visible" || signingOut) return;
      if (Date.now() - lastCheck < SESSION_CHECK_INTERVAL_MS) return;
      lastCheck = Date.now();
      const current = await userManager.getUser();
      if (current?.refresh_token) await refresh().catch(() => undefined);
    }

    const onCheck = () => void checkSession();
    document.addEventListener("visibilitychange", onCheck);
    window.addEventListener("focus", onCheck);
    return () => {
      document.removeEventListener("visibilitychange", onCheck);
      window.removeEventListener("focus", onCheck);
    };
  }, [userManager, refresh]);

  const getAccessToken = useCallback(async () => {
    let current = await userManager.getUser();
    if (!current) throw new Error("Not signed in");
    if (current.expired) current = await refresh();
    if (!current) throw new Error("Session ended, please log in again");
    return current.access_token;
  }, [userManager, refresh]);

  const loginWithRedirect = useCallback(
    async ({ signup, google, sso, returnTo }: RedirectLoginOptions = {}) => {
      const idpHint = google ? "google" : sso ? idpForEmail(sso.email) : "";
      await userManager.signinRedirect({
        state: { returnTo } satisfies LoginState,
        ...(signup && { prompt: "create" }),
        // prefills the username if the domain is unknown and the regular form is shown
        ...(sso && { login_hint: sso.email }),
        ...(idpHint && { extraQueryParams: { kc_idp_hint: idpHint } }),
      });
    },
    [userManager],
  );

  const logout = useCallback(async () => {
    signingOut = true;
    try {
      await userManager.signoutRedirect();
    } catch (e) {
      signingOut = false;
      throw e;
    }
  }, [userManager]);

  const value = useMemo<AuthApi>(
    () => ({
      provider: "keycloak",
      isLoading,
      isAuthenticated: user !== null,
      user: user ? { email: user.profile.email ?? null, name: user.profile.name ?? null } : null,
      error,
      supports: { hostedLogin: true, password: false, google: true, sso: true },
      getAccessToken,
      loginWithRedirect,
      logout,
    }),
    [isLoading, user, error, getAccessToken, loginWithRedirect, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
