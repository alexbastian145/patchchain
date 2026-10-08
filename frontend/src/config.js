// Fill these in after running `npx hardhat run scripts/deploy.js --network sepolia`
// in the project root — the deploy script prints each address.
export const CONTRACT_ADDRESSES = {
  registry: import.meta.env.VITE_REGISTRY_ADDRESS || "",
  stakeManager: import.meta.env.VITE_STAKE_MANAGER_ADDRESS || "",
  escrow: import.meta.env.VITE_ESCROW_ADDRESS || "",
  disclosureTimer: import.meta.env.VITE_DISCLOSURE_TIMER_ADDRESS || "",
};

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

export const REQUIRED_STAKE_ETH = "0.01"; // must match StakeManager's requiredStake on deployment

export const STATUS_LABELS = ["Submitted", "Under Review", "Validated", "Rejected", "Disclosed"];
export const SEVERITY_LABELS = ["Unset", "Low", "Medium", "High", "Critical"];
