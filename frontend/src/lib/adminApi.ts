import type { ApiYearlyCup, ApiSeason, ApiTournament, ApiParticipant, ApiPlayer } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "mm_admin_token";

export const getToken = (): string | null =>
  typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string): void => window.localStorage.setItem(TOKEN_KEY, t);
export const clearToken = (): void => window.localStorage.removeItem(TOKEN_KEY);

export class AuthError extends Error {}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Admin-Token": token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    clearToken();
    throw new AuthError("Unauthorized");
  }
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const verifyToken = (): Promise<{ status: string }> => req("GET", "/admin/check");

export interface AdminPlayer extends ApiPlayer {
  aliases: string[];
}

export interface AuditEntry {
  id: number;
  created_at: string;
  actor: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  entity_type: string;
  entity_id: number | null;
  label: string;
  summary: string;
  changes: { field: string; old: unknown; new: unknown }[];
}
export interface AuditPage {
  items: AuditEntry[];
  total: number;
}

export const adminApi = {
  // cups
  createCup: (b: Record<string, unknown>) => req<ApiYearlyCup>("POST", "/yearly-cups/", b),
  patchCup: (id: number, b: Record<string, unknown>) => req<ApiYearlyCup>("PATCH", `/yearly-cups/${id}`, b),
  deleteCup: (id: number) => req<void>("DELETE", `/yearly-cups/${id}`),
  // seasons
  createSeason: (b: Record<string, unknown>) => req<ApiSeason>("POST", "/seasons/", b),
  patchSeason: (id: number, b: Record<string, unknown>) => req<ApiSeason>("PATCH", `/seasons/${id}`, b),
  deleteSeason: (id: number) => req<void>("DELETE", `/seasons/${id}`),
  // tournaments
  createTournament: (b: Record<string, unknown>) => req<ApiTournament>("POST", "/tournaments/", b),
  patchTournament: (id: number, b: Record<string, unknown>) => req<ApiTournament>("PATCH", `/tournaments/${id}`, b),
  deleteTournament: (id: number) => req<void>("DELETE", `/tournaments/${id}`),
  // participants
  createParticipant: (tid: number, b: Record<string, unknown>) =>
    req<ApiParticipant>("POST", `/tournaments/${tid}/participants`, b),
  patchParticipant: (tid: number, pid: number, b: Record<string, unknown>) =>
    req<ApiParticipant>("PATCH", `/tournaments/${tid}/participants/${pid}`, b),
  deleteParticipant: (tid: number, pid: number) => req<void>("DELETE", `/tournaments/${tid}/participants/${pid}`),
  // players
  createPlayer: (b: Record<string, unknown>) => req<AdminPlayer>("POST", "/players/", b),
  patchPlayer: (id: number, b: Record<string, unknown>) => req<AdminPlayer>("PATCH", `/players/${id}`, b),
  deletePlayer: (id: number) => req<void>("DELETE", `/players/${id}`),
  mergePlayers: (keep_id: number, duplicate_ids: number[]) =>
    req<AdminPlayer>("POST", "/players/merge", { keep_id, duplicate_ids }),
  // audit log
  listAudit: (params: { entity_type?: string; action?: string; limit: number; offset: number }) => {
    const q = new URLSearchParams();
    if (params.entity_type) q.set("entity_type", params.entity_type);
    if (params.action) q.set("action", params.action);
    q.set("limit", String(params.limit));
    q.set("offset", String(params.offset));
    return req<AuditPage>("GET", `/admin/audit?${q.toString()}`);
  },
};
