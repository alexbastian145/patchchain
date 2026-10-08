import { useEffect, useState } from "react";
import { BACKEND_URL } from "../config";

export default function MyReports({ address }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!address) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/researchers/${address}/reports`);
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return (
    <div className="card">
      <h2>My Submitted Reports</h2>
      {loading && <p className="hint">Loading...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && reports.length === 0 && <p className="hint">You haven't submitted any reports yet.</p>}

      {reports.map((r) => {
        const statusClass = "status-" + r.status.replace(" ", "-");
        return (
          <div className="report-row" key={r.reportId}>
            <div>
              <strong>Report #{r.reportId}</strong>
              <div className="meta">
                To {r.organization.slice(0, 6)}...{r.organization.slice(-4)} ·{" "}
                {new Date(r.submittedAt).toLocaleString()}
              </div>
            </div>
            <span className={`status-badge ${statusClass}`}>{r.status}</span>
          </div>
        );
      })}

      <button className="btn-secondary" onClick={load} style={{ marginTop: "1rem" }}>
        Refresh
      </button>
    </div>
  );
}
