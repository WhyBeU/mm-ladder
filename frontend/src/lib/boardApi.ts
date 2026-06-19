// Public pod-registration board API — no auth (anyone with the link can mutate).

export interface ApiBoardState {
  id: number;
  status: "open" | "generated";
  generated_at: string | null;
  last_activity_at: string;
  created_at: string;
}

export interface ApiBoardFormat {
  id: number;
  ordinal: number;
  name: string;
  season_id: number | null;
  created_at: string;
}

export interface ApiBoardSignup {
  id: number;
  player_id: number | null;
  display_name: string;
  is_extra: boolean;
  present: boolean;
  format_id: number | null;
  pod_id: number | null;
  seat: number | null;
  created_at: string;
}

export interface ApiBoardPod {
  id: number;
  format_id: number | null;
  ordinal: number;
  code: string | null;
  created_at: string;
}

export interface ApiBoardEvent {
  id: number;
  kind: string;
  message: string;
  created_at: string;
}

export interface ApiBoard {
  state: ApiBoardState;
  formats: ApiBoardFormat[];
  signups: ApiBoardSignup[];
  pods: ApiBoardPod[];
  events: ApiBoardEvent[];
}

export interface GenerateFormatGroup {
  format_id: number;
  seeding_label?: string;
  pods: number[][];
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const boardApi = {
  get: () => req<ApiBoard>("GET", "/board"),
  addFormat: (body: { season_id?: number; name?: string }) => req<ApiBoard>("POST", "/board/formats", body),
  removeFormat: (id: number) => req<ApiBoard>("DELETE", `/board/formats/${id}`),
  addSignup: (body: { player_id?: number; display_name?: string }) =>
    req<ApiBoard>("POST", "/board/signups", body),
  removeSignup: (id: number) => req<ApiBoard>("DELETE", `/board/signups/${id}`),
  setPresent: (id: number, present: boolean) => req<ApiBoard>("PATCH", `/board/signups/${id}`, { present }),
  moveSignup: (id: number, format_id: number) => req<ApiBoard>("PATCH", `/board/signups/${id}`, { format_id }),
  presentAll: () => req<ApiBoard>("POST", "/board/present-all"),
  generate: (body: { formats: GenerateFormatGroup[] }) => req<ApiBoard>("POST", "/board/generate", body),
  setPodCode: (podId: number, code: string) => req<ApiBoard>("PATCH", `/board/pods/${podId}`, { code }),
  reset: () => req<ApiBoard>("POST", "/board/reset"),
};
