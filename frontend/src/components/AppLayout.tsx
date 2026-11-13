import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/context";
import { useMe } from "../auth/MeProvider";
import { config } from "../config";
import { ProviderSwitcher } from "./ProviderSwitcher";
import { btn, Logo } from "./ui";

export function AppLayout() {
  const { user, logout } = useAuth();
  const { me } = useMe();

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/orders" className="flex shrink-0 items-center gap-2.5 font-semibold">
            <Logo />
            <span className="hidden sm:inline">{config.appName}</span>
          </Link>

          <div className="flex min-w-0 items-center gap-3">
            {me.onboarded && (
              <NavLink
                to="/orders"
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? "text-indigo-600" : "text-zinc-600 hover:text-zinc-900"}`
                }
              >
                Orders
              </NavLink>
            )}
            <span className="hidden max-w-48 truncate text-sm text-zinc-500 md:block">
              {me.email ?? user?.email ?? user?.name}
            </span>
            <ProviderSwitcher />
            <button className={btn.small} onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
