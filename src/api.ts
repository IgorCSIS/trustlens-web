// Talks to the TrustLens backend (FastAPI).
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

export interface Finding {
  check: string;
  impact: string;
  confidence: string;
  description: string;
  lines: number[];
}

export interface ProxyInfo {
  is_proxy: boolean;
  proxy_type: string;
  proxy_address: string;
  implementation_address: string | null;
  scanned_address: string;
  implementation_scanned: boolean;
  admin: string | null;
  admin_is_contract: boolean | null;
  beacon: string | null;
  state_read_ok: boolean;
  note: string;
}

export interface ScanResult {
  target: string;
  engine: string;
  risk_score: number;
  verdict: string;
  summary: Record<string, number>;
  findings: Finding[];
  proxy?: ProxyInfo | null;
}

export interface TriagedFinding {
  check: string;
  original_impact: string;
  verdict: string; // critical | worth-fixing | minor | false-positive
  explanation: string;
  recommendation: string;
  exploit_sketch: string; // real findings only; "" for false positives
  vulnerable_snippet: string;
  fixed_snippet: string;
}

export interface AIReport {
  headline: string;
  adjusted_risk: number;
  verdict: string;
  limitations?: string[]; // what this analysis did NOT check
  triaged: TriagedFinding[];
  disclaimer?: string; // scope + not-an-audit notice, set server-side
}

export interface DeepReport {
  scan: ScanResult;
  report: AIReport;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

/** FREE basic scan — rule-based findings only, no payment. */
export function basicScan(address: string, chain = "base-sepolia"): Promise<ScanResult> {
  return post<ScanResult>("/scan/address", { address, chain });
}

/** Free-beta AI deep report (no payment; server enforces FREE_BETA + rate limit). */
export function fetchReportFree(address: string, chain = "base"): Promise<DeepReport> {
  return post<DeepReport>("/report/address", { address, chain });
}

/** PAID AI deep report via a single pay-per-scan payment. */
export function fetchReport(
  address: string,
  txHash: string,
  paymentId: string,
  chain = "base-sepolia",
): Promise<DeepReport> {
  return post<DeepReport>("/report/address", {
    address,
    chain,
    tx_hash: txHash,
    payment_id: paymentId,
  });
}

/** AI deep report authorized by an active monthly pass (signature proof). */
export function fetchReportWithPass(
  address: string,
  message: string,
  signature: string,
  chain = "base-sepolia",
): Promise<DeepReport> {
  return post<DeepReport>("/report/address", {
    address,
    chain,
    pass_message: message,
    pass_signature: signature,
  });
}
