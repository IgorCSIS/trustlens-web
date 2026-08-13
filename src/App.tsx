import { useEffect, useState } from "react";
import {
  useAccount, useConnect, useDisconnect, usePublicClient,
  useReadContract, useSignMessage, useWriteContract,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { parseEventLogs } from "viem";

import {
  basicScan, fetchReport, fetchReportFree, fetchReportWithPass,
  type DeepReport, type ScanResult, type TriagedFinding,
} from "./api";
import { PAYMENT_GATE, PAYMENT_GATE_ABI } from "./contracts";

// Base mainnet. Free beta: AI reports are free (server enforces the daily cap).
// Set VITE_FREE_BETA=0 to turn the paywall on (needs PaymentGate deployed to mainnet).
const CHAIN = "base";
const FREE_BETA = import.meta.env.VITE_FREE_BETA !== "0";
const DEFAULT_TARGET = "";
const CANCELLED = "No charge. Your report's still here when you want it. Hit the button whenever.";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function badgeClass(v: string) {
  const s = v.toUpperCase();
  if (s.includes("DANGER")) return "danger";
  if (s.includes("RISK")) return "risky";
  if (s.includes("CAUTION")) return "caution";
  return "safe";
}
function pillClass(v: string) {
  const s = v.toLowerCase();
  if (s.includes("false")) return "p-false";
  if (s.includes("minor")) return "p-minor";
  if (s.includes("worth")) return "p-watch";
  return "p-crit";
}
function pillLabel(v: string) {
  const s = v.toLowerCase();
  if (s.includes("false")) return "False alarm";
  if (s.includes("minor")) return "Minor";
  if (s.includes("worth")) return "Worth fixing";
  return "Real risk";
}
function impactClass(impact: string) {
  const s = impact.toLowerCase();
  if (s.includes("high")) return "p-crit";
  if (s.includes("medium")) return "p-watch";
  if (s.includes("low")) return "p-minor";
  return "p-false";
}
function gaugeColor(v: number) {
  if (v < 20) return "var(--safe)";
  if (v < 45) return "var(--watch)";
  return "var(--critical)";
}

function Gauge({ score }: { score: number }) {
  const CIRC = 339.29;
  const [shown, setShown] = useState(0);
  const [offset, setOffset] = useState(CIRC);
  useEffect(() => {
    setOffset(CIRC - CIRC * (score / 100));
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / 900, 1);
      setShown(Math.round(score * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);
  return (
    <div className="gauge">
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle cx="66" cy="66" r="54" fill="none" stroke="var(--inset)" strokeWidth="15" />
        <circle cx="66" cy="66" r="54" fill="none" stroke={gaugeColor(score)} strokeWidth="15"
          strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.3,1,.4,1)" }} />
      </svg>
      <div className="num"><b>{shown}</b><small>/ 100 RISK</small></div>
    </div>
  );
}

function ProofBlock({ f }: { f: TriagedFinding }) {
  const [copied, setCopied] = useState(false);
  if (!f.fixed_snippet) return null;
  async function copyFix() {
    try {
      await navigator.clipboard.writeText(f.fixed_snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  }
  return (
    <details className="proof">
      <summary>🔬 How it's exploited, and the fix</summary>
      {f.exploit_sketch && <p className="exploit">💥 {f.exploit_sketch}</p>}
      {f.vulnerable_snippet && (
        <div className="code bad"><span className="clabel">Vulnerable</span><pre>{f.vulnerable_snippet}</pre></div>
      )}
      <div className="code good">
        <span className="clabel">Fixed, paste this in</span>
        <button className="copy" onClick={copyFix}>{copied ? "✓ Copied" : "Copy"}</button>
        <pre>{f.fixed_snippet}</pre>
      </div>
    </details>
  );
}

export default function App() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();

  const { data: passData, refetch: refetchPass } = useReadContract({
    address: PAYMENT_GATE, abi: PAYMENT_GATE_ABI, functionName: "hasActivePass",
    args: address ? [address] : undefined,
    query: { enabled: !FREE_BETA && isConnected && !!address },
  });
  const hasPass = passData === true;

  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [basicLoading, setBasicLoading] = useState(false);
  const [basic, setBasic] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DeepReport | null>(null);
  const [payStatus, setPayStatus] =
    useState<"" | "paying" | "verifying" | "signing" | "analyzing" | "buyingpass">("");

  const busy = payStatus !== "";

  async function runBasic() {
    if (!target.trim()) { setError("Paste a contract address first."); return; }
    setError(null); setReport(null); setBasic(null); setBasicLoading(true);
    try {
      setBasic(await basicScan(target.trim(), CHAIN));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That one didn't go through. Not you, us. Give it another tap.");
    } finally {
      setBasicLoading(false);
    }
  }

  function reset() {
    setBasic(null); setReport(null); setError(null);
  }

  async function getReport() {
    if (!target.trim()) { setError("Paste a contract address first."); return; }

    // Free beta: no payment, no wallet needed.
    if (FREE_BETA) {
      setError(null); setPayStatus("analyzing");
      try {
        setReport(await fetchReportFree(target.trim(), CHAIN));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Report failed, try again in a moment.");
      } finally {
        setPayStatus("");
      }
      return;
    }

    // Paid mode (FREE_BETA off): pay per scan or use a monthly pass.
    if (!isConnected) { connect({ connector: injected() }); return; }
    if (!publicClient) { setError("No RPC connection. Refresh and try again."); return; }
    setError(null);
    try {
      if (hasPass) {
        setPayStatus("signing");
        const issued = Math.floor(Date.now() / 1000);
        const message = `TrustLens: unlock AI report with monthly pass\naddress: ${address}\nissued: ${issued}`;
        const signature = await signMessageAsync({ message });
        setPayStatus("analyzing");
        setReport(await fetchReportWithPass(target.trim(), message, signature, CHAIN));
      } else {
        setPayStatus("paying");
        const price = (await publicClient.readContract({
          address: PAYMENT_GATE, abi: PAYMENT_GATE_ABI, functionName: "scanPrice",
        })) as bigint;
        const hash = await writeContractAsync({
          address: PAYMENT_GATE, abi: PAYMENT_GATE_ABI,
          functionName: "purchaseScan", args: [target.trim() as `0x${string}`], value: price,
        });
        setPayStatus("verifying");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const logs = parseEventLogs({ abi: PAYMENT_GATE_ABI, eventName: "ScanPurchased", logs: receipt.logs });
        const paymentId = (logs[0]?.args as { paymentId?: bigint })?.paymentId;
        if (paymentId === undefined) throw new Error("Payment event not found in the receipt");
        setPayStatus("analyzing");
        setReport(await fetchReport(target.trim(), hash, paymentId.toString(), CHAIN));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payment failed";
      setError(/reject/i.test(msg) ? CANCELLED : msg);
    } finally {
      setPayStatus("");
    }
  }

  async function buyPass() {
    if (!isConnected) { connect({ connector: injected() }); return; }
    if (!publicClient) return;
    setError(null);
    try {
      setPayStatus("buyingpass");
      const price = (await publicClient.readContract({
        address: PAYMENT_GATE, abi: PAYMENT_GATE_ABI, functionName: "passPrice",
      })) as bigint;
      const hash = await writeContractAsync({
        address: PAYMENT_GATE, abi: PAYMENT_GATE_ABI, functionName: "purchasePass", value: price,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchPass();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Purchase failed";
      setError(/reject/i.test(msg) ? "No charge. Grab the pass whenever." : msg);
    } finally {
      setPayStatus("");
    }
  }

  const rep = report?.report;
  const rawScore = report?.scan.risk_score;

  const reportBtn =
    payStatus === "paying" ? "Confirm in your wallet…"
    : payStatus === "verifying" ? "Confirming payment…"
    : payStatus === "signing" ? "Sign to verify your pass…"
    : payStatus === "analyzing" ? "Reading the code…"
    : FREE_BETA ? "Get the AI report · free 🍬"
    : !isConnected ? "Connect wallet to unlock"
    : hasPass ? "Read the AI report"
    : "Get the AI report · $1.50";

  return (
    <>
      <div className="sky" aria-hidden="true">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" /><div className="blob b4" />
      </div>

      <div className="wrap">
        <header>
          <div className="brand">
            <div className="logo">🍭</div>
            <div>
              <div className="word">Trust<b>Lens</b></div>
              <div className="tag">AI that reads the contract · on Base</div>
            </div>
          </div>
          {isConnected && address ? (
            <button className="btn connect on" onClick={() => disconnect()}>
              {hasPass ? "🎟️ " : ""}{short(address)}
            </button>
          ) : (
            <button className="btn connect" onClick={() => connect({ connector: injected() })}>Connect Wallet</button>
          )}
        </header>

        <section className="scanner glass">
          <h1>Know before you ape.</h1>
          <p className="sub">
            Paste any Base contract address. TrustLens reads the actual code and tells you what's safe,
            what's not, and exactly how to fix it. Free while we're in beta.
          </p>
          <div className="field">
            <label className="addr">
              <span>🔎</span>
              <input value={target} onChange={(e) => setTarget(e.target.value)}
                spellCheck={false} aria-label="Contract address" placeholder="Paste a contract address (0x...)" />
            </label>
            <div className="chip"><span className="dot" />Base</div>
            <button className="btn scanbtn" onClick={runBasic} disabled={basicLoading || busy}>
              {basicLoading ? "Scanning…" : "Scan it free 🍬"}
            </button>
          </div>
          <div className="secondary-cta">
            <button className="linkbtn" onClick={getReport} disabled={busy}>
              Skip to the AI report (free) →
            </button>
          </div>
          <div className="price-note">
            <div>🍬 <b>Free while in beta</b></div>
            <div>🔍 AI reads the real code</div>
            <div>🛡️ Copy-paste fixes</div>
          </div>
        </section>

        {(basicLoading || payStatus === "analyzing") && (
          <section className="loading glass"><div className="lolli" /><div>🔍 Reading every line so you don't have to…</div></section>
        )}
        {error && <section className="errbox glass">⚠️ {error}</section>}

        {/* FREE basic result + unlock */}
        {basic && !report && (
          <section className="report">
            <div className="verdict glass">
              <Gauge score={basic.risk_score} />
              <div className="vmeta">
                <span className={`badge ${badgeClass(basic.verdict)}`}>🔍 Quick scan</span>
                <h2>{basic.findings.length} flag{basic.findings.length === 1 ? "" : "s"} found</h2>
                <p>Raw flags don't tell you what's real. The AI report sorts the genuine risks from
                  the false alarms, and hands you a fix for anything that bites.</p>
              </div>
            </div>

            <div className="flabel">The raw flags</div>
            <div className="findings">
              {basic.findings.map((f, i) => (
                <div className="fcard glass" key={i}>
                  <span className={`pill ${impactClass(f.impact)}`}>{f.impact}</span>
                  <code className="cname">{f.check}</code>
                  <p className="exp">{f.description.split("\n")[0]}</p>
                </div>
              ))}
            </div>

            <div className="unlock glass">
              <div className="em">🍬</div>
              <h3>See what these flags actually mean</h3>
              <p>A scanner points at everything and yells. TrustLens reads the code line by line:
                which flags are real, which are false alarms, and for anything real, a concrete
                attack example plus a fix you can paste straight in.</p>
              <button className="btn scanbtn" onClick={getReport} disabled={busy}>{reportBtn}</button>
              {FREE_BETA && <small>Free while we're in beta 🍬</small>}
              <div style={{ marginTop: 14 }}>
                <button className="linkbtn" onClick={reset} disabled={busy}>Scan another address</button>
              </div>
            </div>
          </section>
        )}

        {/* AI report */}
        {rep && (
          <section className="report">
            <div className="verdict glass">
              <Gauge score={rep.adjusted_risk} />
              <div className="vmeta">
                <span className={`badge ${badgeClass(rep.verdict)}`}>🍬 {rep.verdict}</span>
                <h2>{rep.headline}</h2>
                {typeof rawScore === "number" && rawScore !== rep.adjusted_risk && (
                  <div className="raw">Raw scanner said <s>{report!.scan.verdict} {rawScore}</s>. We read the code → <b>{rep.adjusted_risk}</b></div>
                )}
              </div>
            </div>
            <div className="flabel">The verdict · {rep.triaged.length} flag{rep.triaged.length === 1 ? "" : "s"}</div>
            <div className="findings">
              {rep.triaged.map((f, i) => (
                <div className="fcard glass" key={i}>
                  <span className={`pill ${pillClass(f.verdict)}`}>{pillLabel(f.verdict)}</span>
                  <code className="cname">{f.check}</code>
                  <p className="exp">{f.explanation}</p>
                  <div className="fix">
                    {f.verdict.toLowerCase().includes("false") ? "✓" : "🔧"}{" "}
                    <span><b>{f.recommendation}</b></span>
                  </div>
                  <ProofBlock f={f} />
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button className="btn scanbtn" onClick={reset} disabled={busy} style={{ display: "inline-flex" }}>Scan another address</button>
            </div>

            <div className="access">
              <div className="jar glass"><span className="tag-sticker tag-live">FREE</span><div className="em">🍬</div><h3>Deep Report</h3><div className="amt">Free</div><small>on the house during beta</small></div>
              <div className="jar glass"><span className="tag-sticker tag-soon">SOON</span><div className="em">🎟️</div><h3>Monthly</h3><div className="amt">$9</div><small>unlimited, when payments switch on</small></div>
              <div className="jar glass"><span className="tag-sticker tag-soon">SOON</span><div className="em">💎</div><h3>Founders Pass</h3><div className="amt">lifetime</div><small>one NFT, every scan, forever</small></div>
            </div>
          </section>
        )}

        <footer>
          TrustLens reads contracts, not tea leaves. Built by <b>@SafuLens</b> on X.<br />
          Free beta. Not financial advice. Always verify before you send funds. 🍭
        </footer>
      </div>
    </>
  );
}
