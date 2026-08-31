const BASE = "/api";
const TOKEN_KEY = "dnsdist_token";

let token: string | null = localStorage.getItem(TOKEN_KEY);

export function getToken(): string | null {
  return token;
}

export function setToken(t: string) {
  token = t;
  localStorage.setItem(TOKEN_KEY, t);
}

export function clearToken() {
  token = null;
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new ApiError("Sesi berakhir, silakan login ulang", 401);
  }

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status);
  }

  return res.json() as Promise<T>;
}

// --- Types ---

export interface DBInfo {
  exists: boolean;
  size?: number;
  mod_time?: string;
  error?: string;
}

export interface SyncStatus {
  mode?: string;
  central_url?: string;
  manifest?: Record<string, unknown> | null;
}

export interface PanelConfig {
  block_mode?: string;
  sinkhole?: string;
  upstreams?: string[];
  node_conf?: string;
}

export interface DomainRow {
  id: number;
  domain: string;
  created_at?: string;
}

export interface ExecResult {
  output: string;
  duration: string;
  ok: boolean;
  code: number;
}

export interface DashboardData {
  service_active: boolean;
  dnsdist_api: boolean;
  stats: Record<string, unknown> | null;
  domains_count: number;
  db: DBInfo;
  sync: SyncStatus;
  config: PanelConfig;
  build_version?: string;
  trust_builder?: boolean;
  update_script?: boolean;
  health_script?: boolean;
}

export interface TopEntry {
  rank: number;
  name: string;
  count: number;
}

export interface TopStats {
  status?: string;
  top?: TopEntry[];
}

export interface HealthData {
  result?: ExecResult | null;
  script_error?: boolean;
}

export interface LogsData {
  logs: string;
}

export interface BlacklistStatus extends DBInfo {}

// --- Auth ---

export interface LoginResponse {
  token: string;
  expires_in: number;
}

export async function login(user: string, pass: string): Promise<LoginResponse> {
  return request<LoginResponse>("/login", {
    method: "POST",
    body: JSON.stringify({ user, pass }),
  });
}

// --- Dashboard ---

export async function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>("/dashboard");
}

// --- Sync ---

export async function getSyncStatus(): Promise<SyncStatus> {
  return request<SyncStatus>("/sync/status");
}

export async function syncNow(force: boolean): Promise<{ ok: boolean; result?: ExecResult }> {
  return request<{ ok: boolean; result?: ExecResult }>(
    `/sync?force=${force ? "true" : "false"}`,
    { method: "POST" }
  );
}

// --- Blacklist ---

export async function listDomains(): Promise<{ domains: DomainRow[]; count: number }> {
  return request<{ domains: DomainRow[]; count: number }>("/blacklist/domains");
}

export async function addDomain(domain: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/blacklist/domains", {
    method: "POST",
    body: JSON.stringify({ domain }),
  });
}

export async function deleteDomain(domain: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(
    `/blacklist/domains/${encodeURIComponent(domain)}`,
    { method: "DELETE" }
  );
}

export async function importDomains(
  domains: string[]
): Promise<{ ok: boolean; imported: number }> {
  return request<{ ok: boolean; imported: number }>("/blacklist/import", {
    method: "POST",
    body: JSON.stringify({ domains }),
  });
}

export async function buildBlacklist(): Promise<{ ok: boolean; result?: ExecResult }> {
  return request<{ ok: boolean; result?: ExecResult }>("/blacklist/build", {
    method: "POST",
  });
}

export async function getBlacklistStatus(): Promise<BlacklistStatus> {
  return request<BlacklistStatus>("/blacklist/status");
}

// --- Config ---

export async function getConfig(): Promise<PanelConfig> {
  return request<PanelConfig>("/config");
}

export async function setConfig(centralUrl: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/config", {
    method: "POST",
    body: JSON.stringify({ central_url: centralUrl }),
  });
}

// --- Service ---

export async function serviceReload(): Promise<{ ok: boolean; result?: ExecResult }> {
  return request<{ ok: boolean; result?: ExecResult }>("/service/reload", {
    method: "POST",
  });
}

export async function serviceRestart(): Promise<{ ok: boolean; result?: ExecResult }> {
  return request<{ ok: boolean; result?: ExecResult }>("/service/restart", {
    method: "POST",
  });
}

// --- Stats ---

export async function topQueries(n = 20): Promise<TopStats> {
  return request<TopStats>(`/stats/top-queries?n=${n}`);
}

export async function topBlocked(n = 20): Promise<TopStats> {
  return request<TopStats>(`/stats/top-blocked?n=${n}`);
}

export async function topASN(n = 20): Promise<TopStats> {
  return request<TopStats>(`/stats/top-asn?n=${n}`);
}

// --- Health / Logs ---

export async function getHealth(): Promise<HealthData> {
  return request<HealthData>("/health");
}

export async function getLogs(lines = 100): Promise<LogsData> {
  return request<LogsData>(`/logs?lines=${lines}`);
}

export async function getManifest(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/manifest");
}

// --- Formatting helpers ---

export function formatBytes(n?: number): string {
  if (n === undefined || n === null || isNaN(n)) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Cluster ---

export interface Peer {
  id: number;
  name: string;
  url: string;
  token?: string;
  created_at?: string;
}

export interface ClusterLocal {
  hostname?: string;
  manifest?: Record<string, unknown> | null;
  mode?: string;
  sync?: Record<string, unknown> | null;
}

export interface ProbeResult {
  ok: boolean;
  reachable: boolean;
  health: boolean;
  health_body?: string;
  manifest?: unknown;
}

export async function getCluster(): Promise<{
  local?: ClusterLocal;
  peers?: Peer[];
}> {
  return request<{ local?: ClusterLocal; peers?: Peer[] }>("/cluster");
}

export async function listPeers(): Promise<{ peers: Peer[] }> {
  return request<{ peers: Peer[] }>("/cluster/peers");
}

export async function addPeer(
  name: string,
  url: string,
  token: string
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/cluster/peers", {
    method: "POST",
    body: JSON.stringify({ name, url, token }),
  });
}

export async function deletePeer(name: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/cluster/peers/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export async function probePeer(
  url: string,
  token: string
): Promise<ProbeResult> {
  return request<ProbeResult>("/cluster/peers/probe", {
    method: "POST",
    body: JSON.stringify({ url, token }),
  });
}
