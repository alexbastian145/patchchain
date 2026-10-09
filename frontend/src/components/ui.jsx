import { useState } from "react";

export function Icon({ name, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>;
}

export function Logo({ className = "h-8 w-8" }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-label="PatchChain">
      <path d="M16 2l12 5v8c0 8-5 13-12 15C9 28 4 23 4 15V7z" fill="#00f2fe" fillOpacity=".12" stroke="#00f2fe" strokeWidth="1.5" />
      <path d="M11 16.5l3.5 3.5L21 12" stroke="#4edea3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const short = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "");

export function Addr({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-outline">—</span>;
  return (
    <button
      type="button"
      title="Copy address"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="font-code-md text-code-md text-primary-container hover:text-primary inline-flex items-center gap-1"
    >
      {short(value)}
      <Icon name={copied ? "check" : "content_copy"} className="!text-[14px]" />
    </button>
  );
}

const BADGE = {
  Submitted: "text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30",
  "Under Review": "text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30",
  Validated: "text-secondary bg-secondary/10 border-secondary/30",
  Rejected: "text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/40",
  Disclosed: "text-[#8B5CF6] bg-[#8B5CF6]/10 border-[#8B5CF6]/30",
};

export function StatusBadge({ status }) {
  return (
    <span className={`font-label-sm text-label-sm uppercase tracking-widest px-2 py-0.5 rounded-DEFAULT border ${BADGE[status] || BADGE.Submitted}`}>
      {status}
    </span>
  );
}

export function Panel({ title, icon, action, children }) {
  return (
    <section className="glass rounded-xl p-space-lg flex flex-col gap-space-md">
      {(title || action) && (
        <div className="flex items-center justify-between gap-space-md">
          <h2 className="font-headline-sm text-headline-sm text-primary flex items-center gap-space-sm">
            {icon && <Icon name={icon} className="text-primary-container" />}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export const inputCls =
  "w-full bg-surface-container-lowest text-primary px-4 py-2.5 rounded-lg font-code-md text-code-md border border-outline-variant/40 placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 px-space-md py-2 rounded-lg font-body-md font-semibold text-primary-container bg-primary-container/10 border border-primary-container hover:bg-primary-container hover:text-surface-container-lowest hover:glow transition disabled:opacity-50 disabled:pointer-events-none";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 px-space-md py-2 rounded-lg font-body-md text-on-surface border border-outline-variant hover:border-[#06B6D4] hover:text-primary transition disabled:opacity-50 disabled:pointer-events-none";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 px-space-md py-2 rounded-lg font-body-md text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444] hover:bg-[#EF4444] hover:text-white transition disabled:opacity-50 disabled:pointer-events-none";

export function Notice({ kind = "info", children }) {
  const cls = {
    info: "text-on-surface-variant border-outline-variant/40 bg-surface-container",
    ok: "text-secondary border-secondary/30 bg-secondary/10",
    error: "text-error border-error/40 bg-error-container/20",
  }[kind];
  return <div className={`rounded-lg border px-space-md py-space-sm font-body-md text-body-md break-words ${cls}`}>{children}</div>;
}
