import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError, errorMessage, type Order, useApi } from "../api";
import { cardClass, ErrorBox, Spinner } from "../components/ui";
import { formatCents, formatDate } from "../format";

export function OrderDetailPage() {
  const { orderId = "" } = useParams();
  const api = useApi();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOrder(null);
    setError(null);
    api
      .getOrder(orderId)
      .then((o) => !cancelled && setOrder(o))
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError && e.status === 404 ? "Order not found." : errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [api, orderId]);

  return (
    <div className="space-y-6">
      <Link to="/orders" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
        ← All orders
      </Link>

      {error ? (
        <ErrorBox title="Could not load order" message={error} />
      ) : !order ? (
        <Spinner label="Loading order…" />
      ) : (
        <div className={`${cardClass} p-6`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Order</h1>
            <p className="text-2xl font-semibold tabular-nums">{formatCents(order.price_cents)}</p>
          </div>

          <dl className="mt-6 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <Field label="ID" value={order.id} mono />
            <Field label="Created" value={formatDate(order.created_at)} />
            <Field label="Quantity" value={String(order.qty)} />
            <Field label="Amount in cents" value={String(order.price_cents)} mono />
          </dl>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className={`mt-1 break-all ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
