import { useState } from "react";
import { CONTRACT_ADDRESSES, REQUIRED_STAKE_ETH, STATUS_LABELS, SEVERITY_LABELS, BACKEND_URL } from "../config";
import { Panel, Addr, StatusBadge, Icon, Notice } from "./ui.jsx";

const CONTRACTS = [
  { key: "registry", name: "VulnerabilityRegistry", icon: "fingerprint", desc: "Stores the report hash, IPFS CID, researcher, organization and timestamp, and tracks each report's status." },
  { key: "stakeManager", name: "StakeManager", icon: "lock", desc: `Takes the ${REQUIRED_STAKE_ETH} ETH anti-spam stake and submits the report to the registry on the researcher's behalf.` },
  { key: "escrow", name: "BountyEscrow", icon: "account_balance", desc: "Holds each organization's bounty pool and pays researchers automatically once severity is approved." },
  { key: "disclosureTimer", name: "DisclosureTimer", icon: "schedule", desc: "Tracks the disclosure deadline so a report can be published if the organization does not respond." },
];

export default function Contracts({ chainId }) {
  const [health, setHealth] = useState(null);
  async function ping() {
    try {
      const r = await fetch(`${BACKEND_URL}/api/health`);
      setHealth(r.ok ? "Backend reachable" : `Backend responded ${r.status}`);
    } catch {
      setHealth("Backend not reachable at " + BACKEND_URL);
    }
  }
  const unset = Object.values(CONTRACT_ADDRESSES).some((a) => !a);

  return (
    <div className="flex flex-col gap-space-lg">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Protocol Explorer</h1>
        <p className="text-on-surface-variant">Deployed contracts this frontend is configured to talk to{chainId ? ` (connected chain ${chainId})` : ""}.</p>
      </div>
      {unset && (
        <Notice kind="error">
          Some contract addresses are not set. Copy <code>.env.example</code> to <code>.env</code> and fill in the addresses printed by the deploy script.
        </Notice>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        {CONTRACTS.map((c) => (
          <Panel key={c.key} title={c.name} icon={c.icon}>
            <p className="text-on-surface-variant">{c.desc}</p>
            <div className="flex items-center gap-space-sm"><span className="font-label-sm text-outline uppercase">Address</span><Addr value={CONTRACT_ADDRESSES[c.key]} /></div>
          </Panel>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        <Panel title="Report lifecycle" icon="account_tree">
          <div className="flex flex-wrap gap-space-sm">{STATUS_LABELS.map((s) => <StatusBadge key={s} status={s} />)}</div>
          <p className="font-code-sm text-code-sm text-on-surface-variant">Severity tiers: {SEVERITY_LABELS.slice(1).join(" · ")}</p>
          <p className="font-code-sm text-code-sm text-on-surface-variant">Required stake: {REQUIRED_STAKE_ETH} ETH</p>
        </Panel>
        <Panel title="Backend" icon="dns">
          <p className="text-on-surface-variant">Encrypts reports (AES-256-GCM), pins ciphertext to IPFS and indexes on-chain reports.</p>
          <div className="flex items-center gap-space-md">
            <button onClick={ping} className="px-space-md py-2 rounded-lg border border-outline-variant hover:border-[#06B6D4] text-on-surface"><Icon name="network_check" /> Check</button>
            <span className="font-code-sm text-code-sm text-on-surface-variant">{health}</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
