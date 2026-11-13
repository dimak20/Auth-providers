import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { errorMessage, type Order, useApi } from "../api";
import { btn, cardClass, ErrorBox, inputClass, Spinner } from "../components/ui";
import { formatCents, formatDate, shortId } from "../format";

function newestFirst(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function OrdersPage() {
  const api = useApi();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setOrders(newestFirst(await api.listOrders()));
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-zinc-500">Create orders and browse your history.</p>
      </div>

      <CreateOrderForm onCreated={(order) => setOrders((prev) => [order, ...(prev ?? [])])} />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-700">My orders</h2>

        {loadError ? (
          <ErrorBox title="Could not load orders" message={loadError}>
            <button className={btn.small} onClick={() => void load()}>
              Retry
            </button>
          </ErrorBox>
        ) : orders === null ? (
          <Spinner label="Loading orders…" />
        ) : orders.length === 0 ? (
          <div className={`${cardClass} p-8 text-center text-sm text-zinc-500`}>
            No orders yet. Create your first one above.
          </div>
        ) : (
          <ul className={`${cardClass} divide-y divide-zinc-100 overflow-hidden`}>
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  to={`/orders/${order.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-zinc-50"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium">#{shortId(order.id)}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatCents(order.price_cents)}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">Qty {order.qty}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreateOrderForm({ onCreated }: { onCreated: (order: Order) => void }) {
  const api = useApi();
  const [qty, setQty] = useState("1");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const qtyNum = Number(qty);
    const cents = Math.round(Number(amount.replace(",", ".")) * 100);

    if (!Number.isInteger(qtyNum) || qtyNum < 1) {
      setError("Quantity must be a whole number of at least 1.");
      return;
    }
    if (!Number.isFinite(cents) || cents < 1) {
      setError("Amount must be greater than zero.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      onCreated(await api.createOrder({ qty: qtyNum, price_cents: cents }));
      setQty("1");
      setAmount("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={`${cardClass} p-5`}>
      <h2 className="text-sm font-semibold text-zinc-700">New order</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="qty" className="mb-1.5 block text-xs font-medium text-zinc-600">
            Quantity
          </label>
          <input
            id="qty"
            type="number"
            min={1}
            step={1}
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="amount" className="mb-1.5 block text-xs font-medium text-zinc-600">
            Amount
          </label>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
        </div>
        <button type="submit" disabled={submitting} className={btn.primary}>
          {submitting ? "Creating…" : "Create"}
        </button>
      </div>
      {error && (
        <div className="mt-4">
          <ErrorBox title="Could not create order" message={error} />
        </div>
      )}
    </form>
  );
}
