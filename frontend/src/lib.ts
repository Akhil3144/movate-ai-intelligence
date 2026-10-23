import { hostedApi } from "./browserStorage";
export const BROWSER_STORAGE =
  typeof __MOVATE_SERVERLESS__ !== "undefined" && __MOVATE_SERVERLESS__;

export type Row = Record<string, any>;
export type Scope = { program: string; start: string; end: string };
export const defaults: Scope = {
  program: "",
  start: "2026-07-01",
  end: "2026-10-15",
};
export function params(f: Scope) {
  return new URLSearchParams(f).toString();
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function networkApi(path: string, role: string, body?: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 65000);
  try {
    const response = await fetch("/api" + path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-Demo-Role": role },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if ([408, 504].includes(response.status))
      throw new ApiError(
        "The function timed out. Retry with a narrower date/program scope. Saved browser drafts are unaffected.",
        response.status,
      );
    let value;
    try {
      value = await response.json();
    } catch {
      throw new ApiError(
        "The API returned an unexpected response. Check the deployed /api function and SPA routing configuration.",
        response.status,
      );
    }
    if (!response.ok)
      throw new ApiError(
        value.error?.message || "The API request failed.",
        response.status,
      );
    return value;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === "AbortError")
      throw new ApiError(
        "The function did not respond in time. Try a narrower date/program scope; browser drafts remain on this device.",
        504,
      );
    throw new ApiError(
      "Cannot connect to the /api service. Check your connection, sign in to the private demo, or ask the owner to check the deployment.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}
export async function api(path: string, role: string, body?: unknown) {
  return BROWSER_STORAGE
    ? hostedApi(path, role, body, networkApi)
    : networkApi(path, role, body);
}
export const num = (n: unknown, decimals = 0) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("en-US", { maximumFractionDigits: decimals });
export const money = (n: unknown) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });
export function download(
  name: string,
  text: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows: Row[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replaceAll('"', '""')
      .replace(/^[=+@-]/, "'" + "$&") +
    '"';
  return [
    keys.map(escape).join(","),
    ...rows.map((r) =>
      keys
        .map((k) =>
          escape(typeof r[k] === "object" ? JSON.stringify(r[k]) : r[k]),
        )
        .join(","),
    ),
  ].join("\n");
}
