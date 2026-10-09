const path = require("path");
const { ethers } = require("ethers");

// Load ABIs straight from the Hardhat artifacts produced during contract compilation,
// so the backend never needs a second copy of the ABI to keep in sync by hand.
const registryArtifact = require(path.join(
  __dirname,
  "../../../artifacts/contracts/VulnerabilityRegistry.sol/VulnerabilityRegistry.json"
));
const stakeManagerArtifact = require(path.join(
  __dirname,
  "../../../artifacts/contracts/StakeManager.sol/StakeManager.json"
));
const escrowArtifact = require(path.join(
  __dirname,
  "../../../artifacts/contracts/BountyEscrow.sol/BountyEscrow.json"
));
const timerArtifact = require(path.join(
  __dirname,
  "../../../artifacts/contracts/DisclosureTimer.sol/DisclosureTimer.json"
));

function getProvider() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.AMOY_RPC_URL || "http://127.0.0.1:8545";
  return new ethers.JsonRpcProvider(rpcUrl);
}

function getSigner(provider) {
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY must be set in .env for the backend to send transactions");
  }
  return new ethers.Wallet(process.env.PRIVATE_KEY, provider);
}

function getContracts() {
  const provider = getProvider();
  const signer = getSigner(provider);

  const registry = new ethers.Contract(process.env.REGISTRY_ADDRESS, registryArtifact.abi, signer);
  const stakeManager = new ethers.Contract(
    process.env.STAKE_MANAGER_ADDRESS,
    stakeManagerArtifact.abi,
    signer
  );
  const escrow = new ethers.Contract(process.env.ESCROW_ADDRESS, escrowArtifact.abi, signer);
  const timer = new ethers.Contract(
    process.env.DISCLOSURE_TIMER_ADDRESS,
    timerArtifact.abi,
    signer
  );

  return { provider, signer, registry, stakeManager, escrow, timer };
}

module.exports = { getProvider, getSigner, getContracts };
