/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_DEFAULT_PROVIDER?: string;

  readonly VITE_AUTH0_DOMAIN?: string;
  readonly VITE_AUTH0_CLIENT_ID?: string;
  readonly VITE_AUTH0_AUDIENCE?: string;

  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_KEY?: string;

  readonly VITE_KEYCLOAK_URL?: string;
  readonly VITE_KEYCLOAK_REALM?: string;
  readonly VITE_KEYCLOAK_CLIENT_ID?: string;
  readonly VITE_KEYCLOAK_SSO_IDP?: string;
  readonly VITE_KEYCLOAK_SSO_DOMAINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
