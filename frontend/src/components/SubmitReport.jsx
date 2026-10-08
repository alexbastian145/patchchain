import { useState } from "react";
import { parseEther } from "ethers";
import { getContracts } from "../utils/contracts";
import { BACKEND_URL, REQUIRED_STAKE_ETH } from "../config";

export default function SubmitReport({ signer }) {
  const [form, setForm] = useState({
    organization: "",
    title: "",
    description: "",
    stepsToReproduce: "",
  });
  const [status, setStatus] = useState("idle"); // idle | preparing | submitting | done | error
  const [message, setMessage] = useState("");
  const [reportId, setReportId] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer) {
      setMessage("Connect your wallet first.");
      setStatus("error");
      return;
    }

    try {
      // Step 1: backend encrypts the report and uploads the ciphertext to IPFS,
      // returning the hash + CID the contract call needs.
      setStatus("preparing");
      setMessage("Encrypting report and uploading to IPFS...");

      const prepRes = await fetch(`${BACKEND_URL}/api/reports/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const prepData = await prepRes.json();
      if (!prepRes.ok) throw new Error(prepData.error || "Failed to prepare report");

      // Step 2: researcher's own wallet sends the staked submission transaction —
      // the backend never touches researcher funds.
      setStatus("submitting");
      setMessage("Confirm the transaction in MetaMask (stake: " + REQUIRED_STAKE_ETH + " ETH)...");

      const { stakeManager } = getContracts(signer);
      const tx = await stakeManager.submitReportWithStake(
        prepData.organization,
        prepData.reportHash,
        prepData.cid,
        { value: parseEther(REQUIRED_STAKE_ETH) }
      );
      const receipt = await tx.wait();

      // Pull the reportId out of the ReportSubmitted event emitted by the registry.
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

  if (status === "done") {
    return (
      <div className="card">
        <h2>Report Submitted</h2>
        <p className="success-text">{message}</p>
        {reportId !== null && (
          <p>
            Report ID: <strong>{reportId}</strong> — save this to track its status.
          </p>
        )}
        <button className="btn-secondary" onClick={() => setStatus("idle")}>
          Submit Another Report
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Submit a Vulnerability Report</h2>
      <p className="hint">
        Your report content is encrypted and stored on IPFS. Only a hash and timestamp are
        recorded on-chain. A stake of {REQUIRED_STAKE_ETH} ETH is required and refunded once the
        organization validates your report.
      </p>

      <form onSubmit={handleSubmit}>
        <label>Organization Wallet Address</label>
        <input
          type="text"
          placeholder="0x..."
          value={form.organization}
          onChange={(e) => update("organization", e.target.value)}
          required
        />

        <label>Vulnerability Title</label>
        <input
          type="text"
          placeholder="e.g. Stored XSS in profile bio field"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          required
        />

        <label>Description</label>
        <textarea
          placeholder="Describe the vulnerability, its impact, and affected component."
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          required
        />

        <label>Steps to Reproduce</label>
        <textarea
          placeholder="1. Navigate to...&#10;2. Submit...&#10;3. Observe..."
          value={form.stepsToReproduce}
          onChange={(e) => update("stepsToReproduce", e.target.value)}
        />

        <button
          type="submit"
          className="btn-primary"
          disabled={status === "preparing" || status === "submitting"}
        >
          {status === "preparing" || status === "submitting"
            ? "Processing..."
            : `Submit Report (stake ${REQUIRED_STAKE_ETH} ETH)`}
        </button>

        {message && status !== "done" && (
          <p className={status === "error" ? "error-text" : "hint"}>{message}</p>
        )}
      </form>
    </div>
  );
}
