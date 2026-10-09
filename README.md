# PatchChain

A blockchain-based framework for decentralized vulnerability disclosure and
automated bug bounty payouts.

## Project Structure

```
patchchain/
├── contracts/              Solidity smart contracts
│   ├── VulnerabilityRegistry.sol   Hashed, timestamped report submissions
│   ├── StakeManager.sol            Researcher stake / refund / forfeit
│   ├── BountyEscrow.sol            Severity-tiered payouts + dispute resolution
│   └── DisclosureTimer.sol         Auto-disclosure after deadline
├── scripts/
│   ├── deploy.js            Deploys and wires up all 4 contracts
│   ├── gas-report.js        Prints gas cost for every major operation
│   └── solc-build.js        Manual compile step (see note below)
├── test/
│   └── patchchain.test.js   Full lifecycle test suite (17 tests)
├── backend/                 Node/Express API: IPFS + encryption + contract bridge
│   └── src/
│       ├── routes/          reports.js, queries.js
│       ├── utils/           crypto.js, ipfs.js, contracts.js
│       └── server.js
└── frontend/                React + Vite + ethers.js dApp
    └── src/
        ├── components/      SubmitReport, MyReports, OrgDashboard
        ├── utils/            useWallet (MetaMask), contracts
        └── config.js
```

## A note on compilation

This environment's network policy blocks `binaries.soliditylang.org`, which
Hardhat normally downloads the native `solc` compiler from. `scripts/solc-build.js`
works around this by using the `solc` **npm package** (the WASM build, installed
from the regular npm registry) and writing output directly in Hardhat's artifact
JSON format. On a normal machine with unrestricted internet access, you can
ignore this and just run `npx hardhat compile` as usual — both approaches
produce equivalent artifacts.

```bash
# If `npx hardhat compile` fails in a restricted network environment:
node scripts/solc-build.js
```

## 1. Smart Contracts

```bash
npm install
node scripts/solc-build.js        # or: npx hardhat compile
npx hardhat test --no-compile     # 17 tests, all passing

# Local testing
npx hardhat run scripts/deploy.js --no-compile --network hardhat
npx hardhat run scripts/gas-report.js --no-compile --network hardhat

# Testnet deployment (after filling in .env — see .env.example)
npx hardhat run scripts/deploy.js --no-compile --network sepolia
```

Copy `.env.example` to `.env` and fill in:
- `SEPOLIA_RPC_URL` — from Alchemy or Infura
- `PRIVATE_KEY` — a **throwaway testnet-only** wallet's private key
- `ETHERSCAN_API_KEY` — optional, for contract verification

### Contract addresses

After deploying, copy the four printed addresses into:
- `backend/.env` (`REGISTRY_ADDRESS`, `STAKE_MANAGER_ADDRESS`, `ESCROW_ADDRESS`, `DISCLOSURE_TIMER_ADDRESS`)
- `frontend/.env` (`VITE_REGISTRY_ADDRESS`, etc.)

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env     # fill in RPC URL, private key, Pinata keys, contract addresses
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # generate REPORT_ENCRYPTION_KEY
node src/server.js       # runs on http://localhost:4000
```

Get free Pinata API keys at https://app.pinata.cloud (API Keys section).

### API endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/reports/prepare` | Encrypts report content, uploads to IPFS, returns hash+CID for the frontend to submit on-chain |
| GET | `/api/reports/:id` | Report metadata from the registry contract |
| GET | `/api/reports/:id/decrypt` | Decrypts report content (only once Validated/Disclosed) |
| GET | `/api/organizations/:address/reports` | All reports addressed to an organization |
| GET | `/api/researchers/:address/reports` | All reports submitted by a researcher |
| GET | `/api/reports/:id/timer` | Disclosure countdown status |

## 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env     # fill in contract addresses + backend URL
npm run dev               # http://localhost:5173
```

Requires the MetaMask browser extension, connected to the same network
(Sepolia/Amoy/local Hardhat node) the contracts were deployed to.

## Lifecycle Walkthrough

1. **Researcher** fills out the Submit Report form → backend encrypts content,
   uploads to IPFS, returns `(organization, reportHash, cid)`.
2. Researcher's own wallet calls `StakeManager.submitReportWithStake(...)`,
   staking 0.01 ETH and recording the hash on-chain via the registry.
3. **Organization** opens their dashboard, sees the incoming report, picks a
   severity tier, and clicks **Approve & Pay** → `BountyEscrow.approveAndPay(...)`
   releases the corresponding payout automatically.
4. Organization clicks **Refund Researcher Stake** → `StakeManager.refundStake(...)`.
5. If there's a disagreement, either party can **Raise Dispute**, which routes
   to the arbitrator address set at deployment.
6. If the organization never acts, anyone can call
   `DisclosureTimer.triggerAutoDisclosure(...)` once the configured window
   (90 days by default) has passed, flipping the report's status to `Disclosed`.

## Gas Costs (local Hardhat network, see `scripts/gas-report.js`)

| Operation | Gas Used |
|---|---|
| Deploy VulnerabilityRegistry | 955,406 |
| Deploy StakeManager | 777,465 |
| Deploy BountyEscrow | 1,153,239 |
| Deploy DisclosureTimer | 665,284 |
| submitReportWithStake | 219,448 |
| approveAndPay | 116,929 |
| refundStake | 61,537 |

## Known limitations / next steps

- Report queries (`/api/organizations/:address/reports`) scan event logs —
  fine at testnet scale, but a production version should use an indexer
  (e.g. The Graph) as report volume grows.
- The backend's `PRIVATE_KEY` is only used for read-side convenience scripts;
  all fund-moving transactions (stake, fund, approve, refund) are signed
  client-side via MetaMask, so the backend never custodies researcher or
  organization funds.
- No reputation system yet (planned per the project's original objectives).

## Frontend UI

The React frontend uses a dark "cyber" design system (Tailwind CSS 3, Plus Jakarta Sans / JetBrains Mono, Material Symbols), ported from a Google Stitch design export. Fonts and icons are bundled via npm, so the UI works offline. Screens: Submit Vulnerability, Researcher Reports, Organization Dashboard, Protocol Explorer. Design tokens live in `frontend/tailwind.config.js`.
