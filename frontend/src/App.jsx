import { useState } from "react";
import { useWallet } from "./utils/useWallet";
import { Icon, Logo, short, Notice, btnPrimary } from "./components/ui.jsx";
import SubmitReport from "./components/SubmitReport.jsx";
import MyReports from "./components/MyReports.jsx";
import OrgDashboard from "./components/OrgDashboard.jsx";
import Contracts from "./components/Contracts.jsx";
import { EXPECTED_CHAIN_ID, LOCAL_NETWORK } from "./config";

const TABS = [
  { id: "submit", label: "Submit Vulnerability", needsWallet: true },
  { id: "my-reports", label: "Researcher Reports", needsWallet: true },
  { id: "org", label: "Organization Dashboard", needsWallet: true },
  { id: "contracts", label: "Protocol Explorer", needsWallet: false },
];

async function switchNetwork() {
  const hex = "0x" + EXPECTED_CHAIN_ID.toString(16);
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (err) {
    // 4902 = network not added to MetaMask yet (only auto-addable for the local chain)
    if (err?.code === 4902 || err?.data?.originalError?.code === 4902) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [LOCAL_NETWORK] });
    } else {
      throw err;
    }
  }
}

const CHAIN_NAMES = { 31337: "Hardhat Local", 11155111: "Sepolia", 80002: "Polygon Amoy" };

export default function App() {
  const { address, signer, chainId, error, connect, disconnect } = useWallet();
  const [tab, setTab] = useState("submit");
  const current = TABS.find((t) => t.id === tab);
  const wrongNetwork = Boolean(address && chainId && chainId !== EXPECTED_CHAIN_ID);
  const [switchErr, setSwitchErr] = useState("");

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface font-body-md">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/30">
        <div className="h-16 px-gutter flex items-center justify-between gap-space-md max-w-[1440px] mx-auto">
          <div className="flex items-center gap-space-sm shrink-0">
            <Logo />
            <span className="font-headline-sm text-headline-sm text-primary tracking-tight font-bold hidden sm:inline">PatchChain</span>
          </div>
          <nav className="hidden md:flex items-center gap-space-xs" aria-label="Primary">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`px-space-md py-2 rounded-DEFAULT transition-colors ${
                  tab === t.id
                    ? "bg-surface-container-high text-primary border-b-2 border-primary-container font-semibold"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-space-sm">
            {address ? (
              <button
                onClick={disconnect}
                title="Disconnect (this page only)"
                className="flex items-center gap-space-sm px-space-sm py-1.5 rounded-DEFAULT bg-surface-container-high border border-outline-variant/50"
              >
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                <span className="font-code-md text-code-md text-primary">{short(address)}</span>
                {chainId && <span className="font-code-sm text-code-sm text-outline hidden lg:inline">{CHAIN_NAMES[chainId] || `chain ${chainId}`}</span>}
              </button>
            ) : (
              <button className={btnPrimary} onClick={connect}>
                <Icon name="account_balance_wallet" /> Connect Wallet
              </button>
            )}
          </div>
        </div>
        <nav className="md:hidden flex overflow-x-auto gap-space-xs px-gutter pb-2" aria-label="Primary mobile">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap px-space-sm py-1 rounded-DEFAULT text-body-sm ${
                tab === t.id ? "bg-surface-container-high text-primary" : "text-on-surface-variant"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 w-full pt-24 md:pt-16 max-w-[1440px] mx-auto px-gutter py-space-lg flex flex-col gap-space-lg">
        <div className="pt-space-lg flex flex-col gap-space-lg">
          {error && <Notice kind="error">{error}</Notice>}

          {current.needsWallet && !address ? (
            <section className="glass rounded-xl p-space-xl flex flex-col items-start gap-space-md max-w-2xl glow">
              <Logo className="h-12 w-12" />
              <h1 className="font-headline-lg text-headline-lg text-primary">Connect your wallet to continue</h1>
              <p className="text-on-surface-variant">
                PatchChain uses MetaMask to submit reports, fund bounties and approve payouts directly on-chain.
                The Protocol Explorer tab works without a wallet.
              </p>
              <button className={btnPrimary} onClick={connect}>
                <Icon name="account_balance_wallet" /> Connect Wallet
              </button>
            </section>
          ) : current.needsWallet && wrongNetwork ? (
            <section className="glass rounded-xl p-space-xl flex flex-col items-start gap-space-md max-w-2xl border border-error/40">
              <Icon name="warning" className="text-error !text-[32px]" />
              <h1 className="font-headline-lg text-headline-lg text-primary">Wrong network</h1>
              <p className="text-on-surface-variant">
                MetaMask is on <strong>{CHAIN_NAMES[chainId] || `chain ${chainId}`}</strong>, but PatchChain is deployed on{" "}
                <strong>{CHAIN_NAMES[EXPECTED_CHAIN_ID] || `chain ${EXPECTED_CHAIN_ID}`}</strong>. Transactions are blocked so you
                can't accidentally send real funds.
              </p>
              {switchErr && <Notice kind="error">{switchErr}</Notice>}
              <button className={btnPrimary} onClick={() => switchNetwork().catch((e) => setSwitchErr(e.message || "Could not switch network"))}>
                <Icon name="swap_horiz" /> Switch to {CHAIN_NAMES[EXPECTED_CHAIN_ID] || `chain ${EXPECTED_CHAIN_ID}`}
              </button>
            </section>
          ) : (
            <>
              {tab === "submit" && <SubmitReport signer={signer} />}
              {tab === "my-reports" && <MyReports address={address} />}
              {tab === "org" && <OrgDashboard signer={signer} address={address} />}
              {tab === "contracts" && <Contracts chainId={chainId} />}
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-outline-variant/30 py-space-lg px-gutter text-center font-code-sm text-code-sm text-outline">
        PatchChain · decentralized vulnerability disclosure & bounty payouts · academic prototype, not audited
      </footer>
    </div>
  );
}