import { Navigate, Route, Routes } from "react-router";
import { RequireAuth, RequireOnboarded } from "./auth/guards";
import { AppLayout } from "./components/AppLayout";
import { Landing } from "./pages/Landing";
import { Onboarding } from "./pages/Onboarding";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { OrdersPage } from "./pages/OrdersPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<RequireOnboarded />}>
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
