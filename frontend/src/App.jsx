import { useState } from "react";
import { useWallet } from "./utils/useWallet";
import SubmitReport from "./components/SubmitReport.jsx";
import MyReports from "./components/MyReports.jsx";
import OrgDashboard from "./components/OrgDashboard.jsx";

const TABS = [
  { id: "submit", label: "Submit Report" },
  { id: "my-reports", label: "My Reports" },
  { id: "org", label: "Organization Dashboard" },
];

export default function App() {
  const { address, signer, chainId, error, connect } = useWallet();
  const [tab, setTab] = useState("submit");

  return (
    <div>
      <header className="app-header">
        <div>
          <h1>PatchChain</h1>
          <div className="subtitle">Decentralized Vulnerability Disclosure & Bug Bounty Payouts</div>
        </div>
        <div>
          {address ? (
            <span className="address-pill">
              {address.slice(0, 6)}...{address.slice(-4)}
              {chainId ? ` · chain ${chainId}` : ""}
            </span>
          ) : (
            <button className="connect-btn" onClick={connect}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="container">
        {error && <p className="error-text">{error}</p>}

        {!address && (
          <div className="card">
            <h2>Connect Your Wallet to Continue</h2>
            <p className="hint">
              PatchChain requires MetaMask to submit reports, fund bounties, and approve payouts
              directly on-chain.
            </p>
            <button className="connect-btn" onClick={connect}>
              Connect Wallet
            </button>
          </div>
        )}

        {address && tab === "submit" && <SubmitReport signer={signer} />}
        {address && tab === "my-reports" && <MyReports address={address} />}
        {address && tab === "org" && <OrgDashboard signer={signer} address={address} />}
      </div>
    </div>
  );
}
