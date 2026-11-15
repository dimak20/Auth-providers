import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  errorMessage,
  type Order,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  type PhotoType,
  uploadToStorage,
  useApi,
} from "../api";
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
                  <div className="flex min-w-0 items-center gap-3">
                    <Thumb url={order.photo_url} />
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium">#{shortId(order.id)}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{formatDate(order.created_at)}</p>
                    </div>
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

function Thumb({ url }: { url?: string | null }) {
  if (!url) {
    return <div className="size-10 shrink-0 rounded-lg bg-zinc-100 ring-1 ring-inset ring-zinc-200" />;
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-inset ring-zinc-200"
    />
  );
}

type PhotoState =
  | { status: "none" }
  | { status: "uploading"; preview: string }
  | { status: "done"; preview: string; key: string }
  | { status: "error"; preview: string };

function CreateOrderForm({ onCreated }: { onCreated: (order: Order) => void }) {
  const api = useApi();
  const [qty, setQty] = useState("1");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PhotoState>({ status: "none" });
  const fileInput = useRef<HTMLInputElement>(null);

  // release the local preview URL when it is replaced or the form unmounts
  // (depends on the URL string only: uploading → done keeps the same preview)
  const previewUrl = photo.status === "none" ? null : photo.preview;
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearPhoto() {
    setPhoto({ status: "none" });
    if (fileInput.current) fileInput.current.value = "";
  }

  // Step 1+2: as soon as a file is picked, get a presigned URL and upload straight to S3,
  // while the user is still filling in the form.
  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
      setError("Photo must be a JPEG, PNG or WebP image.");
      clearPhoto();
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError("Photo must be at most 5 MB.");
      clearPhoto();
      return;
    }

    const preview = URL.createObjectURL(file);
    setPhoto({ status: "uploading", preview });
    try {
      const { upload_url, key } = await api.requestUploadUrl(file.type as PhotoType);
      await uploadToStorage(upload_url, file);
      setPhoto({ status: "done", preview, key });
    } catch (err) {
      setPhoto({ status: "error", preview });
      setError(errorMessage(err));
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (photo.status === "uploading") return;
    if (photo.status === "error") {
      setError("The photo failed to upload. Remove it or pick it again.");
      return;
    }
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
      // Step 3: create the order with the key of the already uploaded photo
      onCreated(
        await api.createOrder({
          qty: qtyNum,
          price_cents: cents,
          ...(photo.status === "done" && { url_key: photo.key }),
        }),
      );
      setQty("1");
      setAmount("");
      clearPhoto();
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
        <button type="submit" disabled={submitting || photo.status === "uploading"} className={btn.primary}>
          {submitting ? "Creating…" : photo.status === "uploading" ? "Uploading…" : "Create"}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {photo.status !== "none" && (
          <div className="relative">
            <img
              src={photo.preview}
              alt="Selected photo"
              className={`size-16 rounded-lg object-cover ring-1 ring-inset ring-zinc-200 ${
                photo.status === "uploading" ? "opacity-50" : ""
              }`}
            />
            {photo.status === "uploading" && (
              <span className="absolute inset-0 m-auto size-5 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
            )}
          </div>
        )}
        <label className={`${btn.small} cursor-pointer`}>
          {photo.status === "none" ? "Add photo" : "Change photo"}
          <input
            ref={fileInput}
            type="file"
            accept={PHOTO_TYPES.join(",")}
            onChange={(e) => void onFileChange(e)}
            disabled={submitting || photo.status === "uploading"}
            className="sr-only"
          />
        </label>
        {photo.status !== "none" && photo.status !== "uploading" && (
          <button type="button" onClick={clearPhoto} className={btn.small}>
            Remove
          </button>
        )}
        <span className="text-xs text-zinc-500">
          {photo.status === "done"
            ? "Uploaded"
            : photo.status === "error"
              ? "Upload failed"
              : "JPEG, PNG or WebP, up to 5 MB"}
        </span>
      </div>
      {error && (
        <div className="mt-4">
          <ErrorBox title="Could not create order" message={error} />
        </div>
      )}
    </form>
  );
}
