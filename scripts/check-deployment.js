// Usage: npx hardhat run scripts/check-deployment.js --network <sepolia|localhost>
// Reads the four addresses from backend/.env (or the root .env) and verifies the deployment is wired correctly.
require("dotenv").config({ path: "backend/.env" });
require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  const a = {
    registry: process.env.REGISTRY_ADDRESS,
    stakeManager: process.env.STAKE_MANAGER_ADDRESS,
    escrow: process.env.ESCROW_ADDRESS,
    timer: process.env.DISCLOSURE_TIMER_ADDRESS,
  };
  const net = await ethers.provider.getNetwork();
  console.log("Network:", hre.network.name, "chainId", net.chainId.toString());

  let ok = true;
  for (const [name, addr] of Object.entries(a)) {
    if (!addr) { console.log(`✗ ${name}: address not set in .env`); ok = false; continue; }
    const code = await ethers.provider.getCode(addr);
    const has = code && code !== "0x";
    console.log(`${has ? "✓" : "✗"} ${name} ${addr} ${has ? "has contract code" : "has NO contract code on this network"}`);
    if (!has) ok = false;
  }
  if (!ok) { console.log("\nFix the addresses / network above first."); return; }

  const registry = await ethers.getContractAt("VulnerabilityRegistry", a.registry);
  const stake = await ethers.getContractAt("StakeManager", a.stakeManager);
  const linked = await registry.stakeManager();
  console.log(`${linked.toLowerCase() === a.stakeManager.toLowerCase() ? "✓" : "✗"} registry.stakeManager() = ${linked}`);
  console.log("  expected StakeManager      =", a.stakeManager);
  try { console.log("✓ StakeManager.requiredStake() =", ethers.formatEther(await stake.requiredStake()), "ETH"); }
  catch (e) { console.log("✗ could not read StakeManager.requiredStake():", e.shortMessage || e.message); }
  try { console.log("✓ StakeManager.registry()      =", await stake.registry()); }
  catch (e) { console.log("✗ could not read StakeManager.registry():", e.shortMessage || e.message); }
}
main().catch((e) => { console.error(e); process.exit(1); });
