import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { FullScreen, Spinner } from "../components/ui";
import { useAuth } from "./context";
import { MeProvider, useMe } from "./MeProvider";

/**
 * Lets authenticated users through. Everyone else goes to the provider's hosted
 * login page (Auth0) or to our own login form on "/" (Supabase).
 */
export function RequireAuth() {
  const { isLoading, isAuthenticated, supports, loginWithRedirect } = useAuth();
  const location = useLocation();
  const returnTo = location.pathname + location.search;
  const needsLogin = !isLoading && !isAuthenticated;

  useEffect(() => {
    if (needsLogin && supports.hostedLogin) void loginWithRedirect({ returnTo });
  }, [needsLogin, supports.hostedLogin, loginWithRedirect, returnTo]);

  if (needsLogin && !supports.hostedLogin) {
    return <Navigate to="/" replace state={{ returnTo }} />;
  }

  if (!isAuthenticated) {
    return (
      <FullScreen>
        <Spinner label="Checking session…" />
      </FullScreen>
    );
  }

  return (
    <MeProvider>
      <Outlet />
    </MeProvider>
  );
}

/** Blocks access until the user has completed onboarding. */
export function RequireOnboarded() {
  const { me } = useMe();
  if (!me.onboarded) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
