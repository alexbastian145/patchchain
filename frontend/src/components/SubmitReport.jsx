import { useState } from "react";
import { parseEther } from "ethers";
import { getContracts } from "../utils/contracts";
import { BACKEND_URL, REQUIRED_STAKE_ETH } from "../config";
import { Icon, Panel, Notice, inputCls, btnPrimary, btnGhost } from "./ui.jsx";

const STEPS = [
  { icon: "lock", title: "Encrypt & Pin to IPFS", sub: "Backend encrypts, pins ciphertext" },
  { icon: "account_balance_wallet", title: `Stake ${REQUIRED_STAKE_ETH} ETH`, sub: "Refundable anti-spam deposit" },
  { icon: "token", title: "On-Chain Commitment", sub: "Hash + CID + timestamp recorded" },
  { icon: "schedule", title: "Disclosure Window", sub: "Timer enforces deadline" },
];

export default function SubmitReport({ signer }) {
  const [form, setForm] = useState({ organization: "", title: "", description: "", stepsToReproduce: "" });
  const [status, setStatus] = useState("idle"); // idle | preparing | submitting | done | error
  const [message, setMessage] = useState("");
  const [reportId, setReportId] = useState(null);
  const step = status === "preparing" ? 0 : status === "submitting" ? 1 : status === "done" ? 3 : -1;

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer) {
      setMessage("Connect your wallet first.");
      setStatus("error");
      return;
    }
    try {
      // Backend encrypts the report and uploads ciphertext to IPFS, returning hash + CID.
      setStatus("preparing");
      setMessage("Encrypting report and uploading to IPFS...");
      const prepRes = await fetch(`${BACKEND_URL}/api/reports/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const prepData = await prepRes.json();
      if (!prepRes.ok) throw new Error(prepData.error || "Failed to prepare report");

      // Researcher's own wallet sends the staked transaction — backend never touches funds.
      setStatus("submitting");
      setMessage(`Confirm the transaction in MetaMask (stake: ${REQUIRED_STAKE_ETH} ETH)...`);
      const { stakeManager } = getContracts(signer);
      const tx = await stakeManager.submitReportWithStake(prepData.organization, prepData.reportHash, prepData.cid, {
        value: parseEther(REQUIRED_STAKE_ETH),
      });
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((log) => {
          try {
            return stakeManager.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed && parsed.name === "StakeDeposited");

      setReportId(event ? event.args.reportId.toString() : null);
      setStatus("done");
      setMessage("Report submitted and recorded on-chain.");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage(err.message || "Submission failed");
    }
  }

  const busy = status === "preparing" || status === "submitting";

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="relative overflow-hidden rounded-xl bg-surface-container-high p-space-md flex items-start gap-space-md">
        <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-primary-container">
          <Icon name="shield_lock" className="!text-[24px]" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-sm text-headline-sm text-primary">Submit a Vulnerability Report</h1>
          <p className="text-on-surface-variant max-w-4xl">
            Your report is encrypted (AES-256-GCM) by the PatchChain backend and the ciphertext is stored on IPFS. Only the report hash,
            IPFS CID and timestamp are recorded on-chain. The {REQUIRED_STAKE_ETH} ETH stake is refunded once the organization validates your report.
          </p>
        </div>
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary-container/5 blur-3xl pointer-events-none" />
      </div>

      <div className="bg-surface-container-low rounded-xl p-space-md grid grid-cols-1 md:grid-cols-4 gap-space-md">
        {STEPS.map((s, i) => {
          const active = i === step || (status === "done" && i <= 3);
          return (
            <div key={s.title} className={`relative flex flex-col gap-1 p-space-sm rounded-lg ${active ? "bg-surface-container" : "bg-surface-container-high/60"}`}>
              <div className="flex items-center justify-between">
                <span className={`font-code-sm text-code-sm font-bold ${active ? "text-primary-container" : "text-on-surface-variant"}`}>STEP 0{i + 1}</span>
                <Icon name={s.icon} className={active ? "text-primary-container" : "text-outline"} />
              </div>
              <span className={`font-headline-sm text-[15px] ${active ? "text-primary" : "text-on-surface"}`}>{s.title}</span>
              <span className="text-body-sm text-on-surface-variant">{s.sub}</span>
              {active && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-primary-container rounded-full" />}
            </div>
          );
        })}
      </div>

      {status === "done" ? (
        <Panel title="Report Submitted" icon="verified">
          <Notice kind="ok">{message}</Notice>
          {reportId !== null && (
            <p>Report ID: <strong className="font-code-md text-primary-container">#{reportId}</strong> — find it under Researcher Reports.</p>
          )}
          <div><button className={btnGhost} onClick={() => { setStatus("idle"); setMessage(""); setForm({ organization: "", title: "", description: "", stepsToReproduce: "" }); }}>Submit Another Report</button></div>
        </Panel>
      ) : (
        <form onSubmit={handleSubmit}>
          <Panel title="Report details" icon="bug_report">
            <label className="flex flex-col gap-space-xs">
              <span className="font-label-md text-on-surface-variant uppercase tracking-wider">Organization wallet address</span>
              <input className={inputCls} placeholder="0x..." pattern="^0x[a-fA-F0-9]{40}$" title="A 0x-prefixed 40-hex-character address" value={form.organization} onChange={(e) => update("organization", e.target.value.trim())} required />
            </label>
            <label className="flex flex-col gap-space-xs">
              <span className="font-label-md text-on-surface-variant uppercase tracking-wider">Vulnerability title</span>
              <input className={inputCls} placeholder="e.g. Stored XSS in profile bio field" value={form.title} onChange={(e) => update("title", e.target.value)} required />
            </label>
            <label className="flex flex-col gap-space-xs">
              <span className="font-label-md text-on-surface-variant uppercase tracking-wider">Description</span>
              <textarea className={inputCls + " min-h-[120px]"} placeholder="Describe the vulnerability, its impact, and the affected component." value={form.description} onChange={(e) => update("description", e.target.value)} required />
            </label>
            <label className="flex flex-col gap-space-xs">
              <span className="font-label-md text-on-surface-variant uppercase tracking-wider">Steps to reproduce</span>
              <textarea className={inputCls + " min-h-[120px]"} placeholder={"1. Navigate to...\n2. Submit...\n3. Observe..."} value={form.stepsToReproduce} onChange={(e) => update("stepsToReproduce", e.target.value)} />
            </label>
            {message && <Notice kind={status === "error" ? "error" : "info"}>{message}</Notice>}
            <div>
              <button type="submit" className={btnPrimary} disabled={busy}>
                <Icon name={busy ? "progress_activity" : "send"} className={busy ? "animate-spin" : ""} />
                {busy ? "Processing..." : `Submit Report (stake ${REQUIRED_STAKE_ETH} ETH)`}
              </button>
            </div>
          </Panel>
        </form>
      )}
    </div>
  );
}