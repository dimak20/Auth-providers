import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { errorMessage, type User, useApi } from "../api";
import { ProviderSwitcher } from "../components/ProviderSwitcher";
import { btn, ErrorBox, FullScreen, Spinner } from "../components/ui";
import { useAuth } from "./context";

type MeContextValue = {
  me: User;
  setMe: (user: User) => void;
};

const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const { logout } = useAuth();
  const [me, setMe] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .getMe()
      .then((user) => !cancelled && setMe(user))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, attempt]);

  if (error) {
    return (
      <FullScreen>
        <div className="w-full max-w-md space-y-4">
          <div className="flex justify-end">
            <ProviderSwitcher />
          </div>
          <ErrorBox title="Could not load profile (GET /users/me)" message={error}>
            <button className={btn.small} onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </button>
            <button className={btn.small} onClick={() => void logout()}>
              Log out
            </button>
          </ErrorBox>
        </div>
      </FullScreen>
    );
  }

  if (!me) {
    return (
      <FullScreen>
        <Spinner label="Loading profile…" />
      </FullScreen>
    );
  }

  return <MeContext.Provider value={{ me, setMe }}>{children}</MeContext.Provider>;
}

export function useMe(): MeContextValue {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used inside MeProvider");
  return ctx;
}
