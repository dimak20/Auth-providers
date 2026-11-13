import { config, missingEnv } from "../config";

export type ProviderId = "auth0" | "supabase" | "keycloak";

export type ProviderInfo = {
  id: ProviderId;
  label: string;
  missingEnv: string[];
  comingSoon?: boolean;
};

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "auth0",
    label: "Auth0",
    missingEnv: missingEnv(["VITE_AUTH0_DOMAIN", "VITE_AUTH0_CLIENT_ID", "VITE_AUTH0_AUDIENCE"]),
  },
  {
    id: "supabase",
    label: "Supabase",
    missingEnv: missingEnv(["VITE_SUPABASE_URL", "VITE_SUPABASE_KEY"]),
  },
  {
    id: "keycloak",
    label: "Keycloak",
    missingEnv: missingEnv(["VITE_KEYCLOAK_URL", "VITE_KEYCLOAK_REALM", "VITE_KEYCLOAK_CLIENT_ID"]),
  },
];

export function isUsable(provider: ProviderInfo): boolean {
  return !provider.comingSoon && provider.missingEnv.length === 0;
}

export function providerLabel(id: ProviderId): string {
  return PROVIDERS.find((p) => p.id === id)?.label ?? id;
}

const STORAGE_KEY = "auth-provider";

/** Stored choice → VITE_DEFAULT_PROVIDER → first configured provider. */
export function getSelectedProvider(): ProviderId | null {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // storage unavailable
  }
  const usable = PROVIDERS.filter(isUsable);
  const pick =
    usable.find((p) => p.id === stored) ??
    usable.find((p) => p.id === config.defaultProvider) ??
    usable[0];
  return pick?.id ?? null;
}

/** Saves the choice and reloads, so only one provider SDK is ever mounted. */
export function switchProvider(id: ProviderId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage unavailable: the switch lasts until the next reload
  }
  window.location.assign("/");
}
