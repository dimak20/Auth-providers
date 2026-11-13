import { type FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { errorMessage } from "../api";
import { useAuth } from "../auth/context";
import { providerLabel } from "../auth/registry";
import { PasswordForm } from "../components/PasswordForm";
import { ProviderSwitcher } from "../components/ProviderSwitcher";
import { btn, cardClass, ErrorBox, GoogleIcon, inputClass, Logo, Spinner } from "../components/ui";
import { config } from "../config";

export function Landing() {
  const auth = useAuth();
  const location = useLocation();
  const [actionError, setActionError] = useState<string | null>(null);
  const [ssoOpen, setSsoOpen] = useState(false);
  const [ssoEmail, setSsoEmail] = useState("");
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "/orders";

  if (auth.isAuthenticated) return <Navigate to={returnTo} replace />;

  async function run(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  function onSsoSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void run(() => auth.loginWithRedirect({ sso: { email: ssoEmail.trim() }, returnTo }));
  }

  const error = actionError ?? auth.error;
  const label = providerLabel(auth.provider);
  const { hostedLogin, password, google, sso } = auth.supports;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex justify-end p-4">
        <ProviderSwitcher />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        {auth.isLoading ? (
          <Spinner />
        ) : (
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center text-center">
              <Logo />
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">{config.appName}</h1>
              <p className="mt-1 text-sm text-zinc-500">Demo client for the FastAPI backend</p>
            </div>

            <div className={`${cardClass} space-y-3 p-6`}>
              {error && <ErrorBox title="Sign-in error" message={error} />}

              {hostedLogin && (
                <>
                  <button
                    className={`${btn.primary} w-full`}
                    onClick={() => run(() => auth.loginWithRedirect({ returnTo }))}
                  >
                    Log in
                  </button>
                  <button
                    className={`${btn.secondary} w-full`}
                    onClick={() => run(() => auth.loginWithRedirect({ signup: true, returnTo }))}
                  >
                    Create account
                  </button>
                </>
              )}

              {password && <PasswordForm />}

              {(google || sso) && (
                <div className="flex items-center gap-3 py-1 text-xs text-zinc-400">
                  <span className="h-px flex-1 bg-zinc-200" />
                  or
                  <span className="h-px flex-1 bg-zinc-200" />
                </div>
              )}

              {google && (
                <button
                  className={`${btn.secondary} w-full`}
                  onClick={() => run(() => auth.loginWithRedirect({ google: true, returnTo }))}
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
              )}

              {sso &&
                (ssoOpen ? (
                  <form onSubmit={onSsoSubmit} className="space-y-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
                    <label htmlFor="sso-email" className="block text-xs font-medium text-zinc-600">
                      Work email
                    </label>
                    <input
                      id="sso-email"
                      type="email"
                      required
                      autoFocus
                      autoComplete="email"
                      value={ssoEmail}
                      onChange={(e) => setSsoEmail(e.target.value)}
                      placeholder="you@company.com"
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <button type="submit" className={`${btn.primary} flex-1`}>
                        Continue
                      </button>
                      <button type="button" className={btn.small} onClick={() => setSsoOpen(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button className={`${btn.secondary} w-full`} onClick={() => setSsoOpen(true)}>
                    <BuildingIcon />
                    Sign in with SSO
                  </button>
                ))}
            </div>

            <p className="mt-6 text-center text-xs text-zinc-500">
              {hostedLogin
                ? `Sign-in and sign-up happen on the ${label} hosted page.`
                : `Signing in with ${label} Auth.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-zinc-500" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M4 2a1 1 0 0 0-1 1v15H2a.75.75 0 0 0 0 1.5h16a.75.75 0 0 0 0-1.5h-1V9a1 1 0 0 0-1-1h-4V3a1 1 0 0 0-1-1H4Zm8 7.5V18h3.5V9.5H12ZM5.5 5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V5Zm.5 3a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1A.5.5 0 0 0 7 8H6Zm2.5-3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5H9a.5.5 0 0 1-.5-.5V5ZM9 8a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1A.5.5 0 0 0 10 8H9Zm-3.5 4a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5v-1ZM9 11.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5H9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
