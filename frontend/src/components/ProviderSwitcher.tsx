import { useAuth } from "../auth/context";
import { isUsable, PROVIDERS, switchProvider } from "../auth/registry";

export function ProviderSwitcher() {
  const { provider } = useAuth();

  return (
    <div
      role="radiogroup"
      aria-label="Auth provider"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5 ring-1 ring-inset ring-zinc-200"
    >
      {PROVIDERS.map((p) => {
        const active = p.id === provider;
        const title = p.comingSoon
          ? "Coming soon"
          : p.missingEnv.length > 0
            ? `Set ${p.missingEnv.join(", ")} in frontend/.env.local`
            : `Use ${p.label}`;

        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={!isUsable(p)}
            title={title}
            onClick={() => !active && switchProvider(p.id)}
            className={
              "rounded-md px-2.5 py-1 text-xs font-medium transition " +
              (active
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:hover:text-zinc-400")
            }
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
