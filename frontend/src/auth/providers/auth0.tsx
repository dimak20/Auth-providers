import { type AppState, Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { type ReactNode, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { config } from "../../config";
import { type AuthApi, AuthContext, type RedirectLoginOptions } from "../context";

export function Auth0AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const onRedirectCallback = (appState?: AppState) => {
    navigate(appState?.returnTo ?? "/orders", { replace: true });
  };

  return (
    <Auth0Provider
      domain={config.auth0.domain}
      clientId={config.auth0.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: config.auth0.audience,
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      onRedirectCallback={onRedirectCallback}
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
}

function Auth0Bridge({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user, error, getAccessTokenSilently, loginWithRedirect, logout } =
    useAuth0();

  const getAccessToken = useCallback(async () => {
    const token = await getAccessTokenSilently();
    if (!token) throw new Error("Auth0 returned no access token");
    return token;
  }, [getAccessTokenSilently]);

  const login = useCallback(
    async ({ signup, google, returnTo }: RedirectLoginOptions = {}) => {
      await loginWithRedirect({
        appState: { returnTo },
        authorizationParams: {
          ...(signup && { screen_hint: "signup" }),
          ...(google && { connection: "google-oauth2" }),
        },
      });
    },
    [loginWithRedirect],
  );

  const signOut = useCallback(async () => {
    await logout({ logoutParams: { returnTo: window.location.origin } });
  }, [logout]);

  const value = useMemo<AuthApi>(
    () => ({
      provider: "auth0",
      isLoading,
      isAuthenticated,
      user: user ? { email: user.email ?? null, name: user.name ?? null } : null,
      error: error?.message ?? null,
      supports: { hostedLogin: true, password: false, google: true, sso: false },
      getAccessToken,
      loginWithRedirect: login,
      logout: signOut,
    }),
    [isLoading, isAuthenticated, user, error, getAccessToken, login, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
