import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { ApiError, errorMessage, useApi } from "../api";
import { useAuth } from "../auth/context";
import { useMe } from "../auth/MeProvider";
import { btn, cardClass, ErrorBox, inputClass } from "../components/ui";

export function Onboarding() {
  const { me, setMe } = useMe();
  const { user } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const [email, setEmail] = useState(me.email ?? user?.email ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (me.onboarded) return <Navigate to="/orders" replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.updateMe({ email: email.trim() });
      setMe(updated);
      navigate("/orders", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
        setError("The backend has no PATCH /api/v1/users/me yet, so onboarding can't be saved.");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <p className="text-sm font-medium text-indigo-600">One last step</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Finish signing up</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Enter your email so we can link orders to your account.
      </p>

      <form onSubmit={onSubmit} className={`${cardClass} mt-6 space-y-4 p-6`}>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>

        {error && <ErrorBox title="Could not save" message={error} />}

        <button type="submit" disabled={submitting} className={`${btn.primary} w-full`}>
          {submitting ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
