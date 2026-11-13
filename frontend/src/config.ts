const env = import.meta.env;

export const config = {
  apiUrl: (env.VITE_API_URL ?? "http://localhost:8000").replace(/\/+$/, ""),
  appName: env.VITE_APP_NAME || "Auth Providers",
  defaultProvider: env.VITE_DEFAULT_PROVIDER,
  auth0: {
    domain: env.VITE_AUTH0_DOMAIN ?? "",
    clientId: env.VITE_AUTH0_CLIENT_ID ?? "",
    audience: env.VITE_AUTH0_AUDIENCE ?? "",
  },
  supabase: {
    url: env.VITE_SUPABASE_URL ?? "",
    key: env.VITE_SUPABASE_KEY ?? "",
  },
  keycloak: {
    url: (env.VITE_KEYCLOAK_URL ?? "").replace(/\/+$/, ""),
    realm: env.VITE_KEYCLOAK_REALM ?? "",
    clientId: env.VITE_KEYCLOAK_CLIENT_ID ?? "",
    ssoIdp: env.VITE_KEYCLOAK_SSO_IDP ?? "",
    ssoDomains: parseDomainMap(env.VITE_KEYCLOAK_SSO_DOMAINS),
  },
};

/** "acme.com:acme, globex.com:globex" → { "acme.com": "acme", "globex.com": "globex" } */
function parseDomainMap(raw: string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const pair of (raw ?? "").split(",")) {
    const [domain, alias] = pair.split(":").map((s) => s.trim());
    if (domain && alias) map[domain.toLowerCase()] = alias;
  }
  return map;
}

/** Returns the names of env vars from `keys` that are not set. */
export function missingEnv(keys: string[]): string[] {
  return keys.filter((key) => !env[key]);
}
