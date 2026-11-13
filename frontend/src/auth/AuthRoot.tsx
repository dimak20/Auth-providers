import type { ReactNode } from "react";
import { Auth0AuthProvider } from "./providers/auth0";
import { KeycloakAuthProvider } from "./providers/keycloak";
import { SupabaseAuthProvider } from "./providers/supabase";
import type { ProviderId } from "./registry";

export function AuthRoot({ provider, children }: { provider: ProviderId; children: ReactNode }) {
  switch (provider) {
    case "auth0":
      return <Auth0AuthProvider>{children}</Auth0AuthProvider>;
    case "supabase":
      return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
    case "keycloak":
      return <KeycloakAuthProvider>{children}</KeycloakAuthProvider>;
  }
}
