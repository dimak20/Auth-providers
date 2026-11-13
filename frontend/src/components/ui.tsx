import type { ReactNode } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const btn = {
  primary: `${base} bg-indigo-600 px-4 py-2.5 text-white shadow-sm hover:bg-indigo-500`,
  secondary: `${base} bg-white px-4 py-2.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50`,
  small: `${base} bg-white px-3 py-1.5 text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50`,
};

export const inputClass =
  "block w-full rounded-lg bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 " +
  "placeholder:text-zinc-400 focus:ring-2 focus:ring-indigo-600 focus:outline-none";

export const cardClass = "rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200";

export function FullScreen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-4 py-12">{children}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-zinc-500" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
      {label ?? "Loading…"}
    </div>
  );
}

export function ErrorBox({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-red-50 p-4 text-sm ring-1 ring-inset ring-red-200" role="alert">
      <p className="font-semibold text-red-800">{title}</p>
      <p className="mt-1 break-words text-red-700">{message}</p>
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Logo() {
  return (
    <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
      AP
    </span>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}
