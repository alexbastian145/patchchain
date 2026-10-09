import { useEffect, useState } from "react";
import { BACKEND_URL } from "../config";
import { Panel, Addr, StatusBadge, Icon, Notice, btnGhost } from "./ui.jsx";

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

  const count = (s) => reports.filter((r) => r.status === s).length;
  const stats = [
    { label: "Total", value: reports.length, cls: "text-primary" },
    { label: "Pending", value: count("Submitted") + count("Under Review"), cls: "text-[#F59E0B]" },
    { label: "Validated", value: count("Validated"), cls: "text-secondary" },
    { label: "Disclosed", value: count("Disclosed"), cls: "text-[#8B5CF6]" },
  ];

  return (
    <div className="flex flex-col gap-space-lg">
      <h1 className="font-headline-lg text-headline-lg text-primary">Researcher Reports</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl p-space-md">
            <div className="font-label-md text-outline uppercase tracking-wider">{s.label}</div>
            <div className={`font-headline-lg text-headline-lg ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <Panel
        title="My submitted reports"
        icon="list_alt"
        action={<button className={btnGhost} onClick={load} disabled={loading}><Icon name="refresh" className={loading ? "animate-spin" : ""} /> Refresh</button>}
      >
        {error && <Notice kind="error">{error}</Notice>}
        {!loading && !error && reports.length === 0 && <p className="text-on-surface-variant">You haven't submitted any reports yet.</p>}
        <div className="flex flex-col divide-y divide-outline-variant/30">
          {reports.map((r) => (
            <div key={r.reportId} className="flex items-center justify-between gap-space-md py-space-sm flex-wrap">
              <div className="flex flex-col gap-1">
                <span className="font-code-md text-code-md text-primary">Report #{r.reportId}</span>
                <span className="text-body-sm text-on-surface-variant flex items-center gap-space-sm flex-wrap">
                  To <Addr value={r.organization} /> · {new Date(r.submittedAt).toLocaleString()}
                </span>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
