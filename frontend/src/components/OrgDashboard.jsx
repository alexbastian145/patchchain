import { useEffect, useState } from "react";
import { parseEther } from "ethers";
import { getContracts } from "../utils/contracts";
import { BACKEND_URL, STATUS_LABELS, SEVERITY_LABELS } from "../config";

export default function OrgDashboard({ signer, address }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fundAmount, setFundAmount] = useState("0.5");
  const [actionMessage, setActionMessage] = useState("");

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

  async function handleFund() {
    try {
      setActionMessage("Funding escrow...");
      const { escrow } = getContracts(signer);
      const tx = await escrow.fund({ value: parseEther(fundAmount) });
      await tx.wait();
      setActionMessage(`Funded escrow with ${fundAmount} ETH.`);
    } catch (err) {
      setActionMessage("Error: " + err.message);
    }
  }

  async function handleApprove(reportId, severity) {
    try {
      setActionMessage(`Approving report #${reportId} at severity ${SEVERITY_LABELS[severity]}...`);
      const { escrow } = getContracts(signer);
      const tx = await escrow.approveAndPay(reportId, severity);
      await tx.wait();
      setActionMessage(`Report #${reportId} approved and paid.`);
      loadReports();
    } catch (err) {
      setActionMessage("Error: " + err.message);
    }
  }

  async function handleRefundStake(reportId) {
    try {
      setActionMessage(`Refunding stake for report #${reportId}...`);
      const { stakeManager } = getContracts(signer);
      const tx = await stakeManager.refundStake(reportId);
      await tx.wait();
      setActionMessage(`Stake refunded for report #${reportId}.`);
    } catch (err) {
      setActionMessage("Error: " + err.message);
    }
  }

  async function handleDispute(reportId) {
    try {
      setActionMessage(`Raising dispute for report #${reportId}...`);
      const { escrow } = getContracts(signer);
      const tx = await escrow.raiseDispute(reportId);
      await tx.wait();
      setActionMessage(`Dispute raised for report #${reportId}.`);
      loadReports();
    } catch (err) {
      setActionMessage("Error: " + err.message);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Fund Bounty Escrow</h2>
        <p className="hint">Deposit ETH into your organization's bounty pool.</p>
        <label>Amount (ETH)</label>
        <input value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} />
        <button className="btn-primary" onClick={handleFund}>
          Fund Escrow
        </button>
        {actionMessage && <p className="hint">{actionMessage}</p>}
      </div>

      <div className="card">
        <h2>Incoming Reports</h2>
        {loading && <p className="hint">Loading...</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && reports.length === 0 && <p className="hint">No reports yet.</p>}

        {reports.map((r) => (
          <ReportRow
            key={r.reportId}
            report={r}
            onApprove={handleApprove}
            onRefundStake={handleRefundStake}
            onDispute={handleDispute}
          />
        ))}

        <button className="btn-secondary" onClick={loadReports} style={{ marginTop: "1rem" }}>
          Refresh
        </button>
      </div>
    </div>
  );
}

function ReportRow({ report, onApprove, onRefundStake, onDispute }) {
  const [severity, setSeverity] = useState(3);
  const statusClass = "status-" + report.status.replace(" ", "-");

  return (
    <div className="report-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <strong>Report #{report.reportId}</strong>
          <div className="meta">
            From {report.researcher.slice(0, 6)}...{report.researcher.slice(-4)} ·{" "}
            {new Date(report.submittedAt).toLocaleString()}
          </div>
        </div>
        <span className={`status-badge ${statusClass}`}>{report.status}</span>
      </div>

      {report.status === "Submitted" && (
        <div style={{ marginTop: "0.75rem" }}>
          <label style={{ margin: "0 0 0.35rem" }}>Assign Severity & Approve Payout</label>
          <div className="severity-select">
            {SEVERITY_LABELS.slice(1).map((label, idx) => (
              <button
                key={label}
                className={`severity-btn ${severity === idx + 1 ? "selected" : ""}`}
                onClick={() => setSeverity(idx + 1)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: "0.6rem" }}>
            <button className="btn-primary" onClick={() => onApprove(report.reportId, severity)}>
              Approve & Pay
            </button>
            <button
              className="btn-secondary"
              onClick={() => onDispute(report.reportId)}
              style={{ marginLeft: "0.5rem" }}
            >
              Raise Dispute
            </button>
          </div>
        </div>
      )}

      {report.status === "Validated" && (
        <div style={{ marginTop: "0.75rem" }}>
          <button className="btn-secondary" onClick={() => onRefundStake(report.reportId)}>
            Refund Researcher Stake
          </button>
        </div>
      )}
    </div>
  );
}
