import { useEffect, useState } from "react";
import { parseEther, formatEther } from "ethers";
import { getContracts } from "../utils/contracts";
import { BACKEND_URL, SEVERITY_LABELS } from "../config";
import { Panel, Addr, StatusBadge, Icon, Notice, inputCls, btnPrimary, btnGhost, btnDanger } from "./ui.jsx";

export default function OrgDashboard({ signer, address }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fundAmount, setFundAmount] = useState("0.5");
  const [action, setAction] = useState({ kind: "info", text: "" });
  const [busy, setBusy] = useState(false);

  async function loadReports() {
    if (!address) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/organizations/${address}/reports`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load reports");
      setReports(data.reports);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  async function run(pending, success, fn, reload = false) {
    setBusy(true);
    setAction({ kind: "info", text: pending });
    try {
      const tx = await fn(getContracts(signer));
      await tx.wait();
      setAction({ kind: "ok", text: success });
      if (reload) loadReports();
    } catch (err) {
      setAction({ kind: "error", text: "Error: " + (err.shortMessage || err.message) });
    } finally {
      setBusy(false);
    }
  }

  const handleFund = () =>
    run("Funding escrow...", `Funded escrow with ${fundAmount} ETH.`, (c) => c.escrow.fund({ value: parseEther(fundAmount) }));
  const [tiers, setTiers] = useState({ 1: "0.05", 2: "0.1", 3: "0.2", 4: "0.5" });

  useEffect(() => {
    // Pre-fill the tier inputs with whatever is already set on-chain for this organization.
    if (!signer || !address) return;
    (async () => {
      try {
        const { escrow } = getContracts(signer);
        const next = {};
        for (const s of [1, 2, 3, 4]) {
          const v = await escrow.bountyTiers(address, s);
          if (v > 0n) next[s] = formatEther(v);
        }
        setTiers((t) => ({ ...t, ...next }));
      } catch {
        /* contracts not configured yet */
      }
    })();
  }, [signer, address]);

  async function handleSaveTiers() {
    setBusy(true);
    try {
      const { escrow } = getContracts(signer);
      for (const s of [1, 2, 3, 4]) {
        setAction({ kind: "info", text: `Saving ${SEVERITY_LABELS[s]} tier (${s}/4) — confirm in MetaMask...` });
        const tx = await escrow.setBountyTier(s, parseEther(tiers[s] || "0"));
        await tx.wait();
      }
      setAction({ kind: "ok", text: "Bounty tiers saved on-chain." });
    } catch (err) {
      setAction({ kind: "error", text: "Error: " + (err.shortMessage || err.message) });
    } finally {
      setBusy(false);
    }
  }

  const handleApprove = (id, sev) =>
    run(`Approving report #${id} as ${SEVERITY_LABELS[sev]}...`, `Report #${id} approved and paid.`, (c) => c.escrow.approveAndPay(id, sev), true);
  const handleRefundStake = (id) =>
    run(`Refunding stake for report #${id}...`, `Stake refunded for report #${id}.`, (c) => c.stakeManager.refundStake(id));
  const handleDispute = (id) =>
    run(`Raising dispute for report #${id}...`, `Dispute raised for report #${id}.`, (c) => c.escrow.raiseDispute(id), true);

  return (
    <div className="flex flex-col gap-space-lg">
      <h1 className="font-headline-lg text-headline-lg text-primary">Organization Dashboard</h1>
      {action.text && <Notice kind={action.kind}>{action.text}</Notice>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <div className="lg:col-span-4">
          <Panel title="Fund bounty escrow" icon="account_balance">
            <p className="text-on-surface-variant">Deposit ETH into your organization's bounty pool.</p>
            <label className="flex flex-col gap-space-xs">
              <span className="font-label-md text-on-surface-variant uppercase tracking-wider">Amount (ETH)</span>
              <input className={inputCls} value={fundAmount} inputMode="decimal" onChange={(e) => setFundAmount(e.target.value)} />
            </label>
            <div><button className={btnPrimary} onClick={handleFund} disabled={busy}><Icon name="add_card" /> Fund Escrow</button></div>
          </Panel>
          <div className="mt-gutter">
            <Panel title="Bounty tiers" icon="tune">
              <p className="text-on-surface-variant">Payout per severity, in ETH. Must be set (and the escrow funded) before you can approve a report.</p>
              {[1, 2, 3, 4].map((s) => (
                <label key={s} className="flex items-center justify-between gap-space-md">
                  <span className="font-label-md text-on-surface-variant uppercase tracking-wider">{SEVERITY_LABELS[s]}</span>
                  <input className={inputCls + " !w-32 text-right"} inputMode="decimal" value={tiers[s]} onChange={(e) => setTiers((t) => ({ ...t, [s]: e.target.value }))} />
                </label>
              ))}
              <div><button className={btnPrimary} onClick={handleSaveTiers} disabled={busy}><Icon name="save" /> Save Tiers (4 txs)</button></div>
            </Panel>
          </div>
        </div>
        <div className="lg:col-span-8">
          <Panel
            title="Incoming reports"
            icon="inbox"
            action={<button className={btnGhost} onClick={loadReports} disabled={loading}><Icon name="refresh" className={loading ? "animate-spin" : ""} /> Refresh</button>}
          >
            {error && <Notice kind="error">{error}</Notice>}
            {!loading && !error && reports.length === 0 && <p className="text-on-surface-variant">No reports yet.</p>}
            <div className="flex flex-col gap-space-md">
              {reports.map((r) => (
                <ReportRow key={r.reportId} report={r} busy={busy} onApprove={handleApprove} onRefundStake={handleRefundStake} onDispute={handleDispute} />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ReportRow({ report, busy, onApprove, onRefundStake, onDispute }) {
  const [severity, setSeverity] = useState(3);
  return (
    <div className="rounded-lg bg-surface-container p-space-md flex flex-col gap-space-sm">
      <div className="flex items-center justify-between gap-space-md flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="font-code-md text-code-md text-primary">Report #{report.reportId}</span>
          <span className="text-body-sm text-on-surface-variant flex items-center gap-space-sm flex-wrap">
            From <Addr value={report.researcher} /> · {new Date(report.submittedAt).toLocaleString()}
          </span>
        </div>
        <StatusBadge status={report.status} />
      </div>

      {report.status === "Submitted" && (
        <div className="flex flex-col gap-space-sm">
          <span className="font-label-md text-on-surface-variant uppercase tracking-wider">Assign severity & approve payout</span>
          <div className="flex gap-space-sm flex-wrap" role="radiogroup" aria-label="Severity">
            {SEVERITY_LABELS.slice(1).map((label, idx) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={severity === idx + 1}
                onClick={() => setSeverity(idx + 1)}
                className={`px-space-md py-1 rounded-lg border font-label-md ${
                  severity === idx + 1 ? "border-primary-container text-primary-container bg-primary-container/10" : "border-outline-variant text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-space-sm flex-wrap">
            <button className={btnPrimary} disabled={busy} onClick={() => onApprove(report.reportId, severity)}><Icon name="paid" /> Approve & Pay</button>
            <button className={btnDanger} disabled={busy} onClick={() => onDispute(report.reportId)}><Icon name="gavel" /> Raise Dispute</button>
          </div>
        </div>
      )}

      {report.status === "Validated" && (
        <div><button className={btnGhost} disabled={busy} onClick={() => onRefundStake(report.reportId)}><Icon name="undo" /> Refund Researcher Stake</button></div>
      )}
    </div>
  );
}
