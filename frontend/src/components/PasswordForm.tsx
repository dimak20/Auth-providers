import { type FormEvent, useState } from "react";
import { errorMessage } from "../api";
import { useAuth } from "../auth/context";
import { btn, ErrorBox, inputClass } from "./ui";

type Mode = "login" | "signup";

export function PasswordForm() {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!signInWithPassword || !signUpWithPassword) return null;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "login") {
        await signInWithPassword!(email.trim(), password);
      } else {
        const { needsConfirmation } = await signUpWithPassword!(email.trim(), password);
        if (needsConfirmation) {
          setMode("login");
          setInfo("Check your inbox and confirm your email, then log in.");
        }
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      onClick={() => switchMode(value)}
      className={
        "flex-1 rounded-md py-1.5 text-sm font-medium transition " +
        (mode === value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900")
      }
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
        {tab("login", "Log in")}
        {tab("signup", "Sign up")}
      </div>

      <div>
        <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      {error && <ErrorBox title={mode === "login" ? "Could not log in" : "Could not sign up"} message={error} />}
      {info && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
          {info}
        </p>
      )}

      <button type="submit" disabled={submitting} className={`${btn.primary} w-full`}>
        {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>
    </form>
  );
}
