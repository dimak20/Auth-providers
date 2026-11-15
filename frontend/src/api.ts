import { useMemo } from "react";
import { useAuth } from "./auth/context";
import { config } from "./config";

export type User = {
  id: string;
  external_id: string;
  email: string | null;
  onboarded: boolean;
  provider: string;
  created_at: string;
};

export type Order = {
  id: string;
  qty: number;
  price_cents: number;
  user_id: string;
  created_at: string;
  photo_url?: string | null; // presigned GET, short-lived
};

export type OrderCreate = {
  qty: number;
  price_cents: number;
  url_key?: string; // key returned by requestUploadUrl, after the file was uploaded
};

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export type UploadUrl = {
  upload_url: string;
  key: string;
};

/** PUT the file straight to S3 via a presigned URL (no API token: the signature is the auth). */
export async function uploadToStorage(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type }, // must match the content type the URL was signed for
    body: file,
  });
  if (!res.ok) throw new ApiError(res.status, `Upload failed: ${res.statusText || res.status}`);
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return `${e.status}: ${e.message}`;
  if (e instanceof TypeError) {
    return "Could not reach the API. Is the backend running and does CORS allow this origin?";
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

async function readDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    if (body?.detail) return JSON.stringify(body.detail);
  } catch {
    // body is not JSON
  }
  return res.statusText || `HTTP ${res.status}`;
}

export function useApi() {
  const { getAccessToken } = useAuth();

  return useMemo(() => {
    async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
      const token = await getAccessToken();
      const res = await fetch(`${config.apiUrl}/api/v1${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined && { "Content-Type": "application/json" }),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new ApiError(res.status, await readDetail(res));
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }

    return {
      getMe: () => request<User>("/users/me"),
      updateMe: (data: { email: string }) => request<User>("/users/me", "PATCH", data),
      listOrders: () => request<Order[]>("/orders"),
      getOrder: (id: string) => request<Order>(`/orders/${encodeURIComponent(id)}`),
      createOrder: (data: OrderCreate) => request<Order>("/orders", "POST", data),
      requestUploadUrl: (contentType: PhotoType) =>
        request<UploadUrl>("/orders/uploads", "POST", { content_type: contentType }),
    };
  }, [getAccessToken]);
}
