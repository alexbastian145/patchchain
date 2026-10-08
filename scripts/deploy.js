const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const arbitrator = deployer;
  console.log("Deploying contracts with account:", deployer.address);

  const REQUIRED_STAKE = hre.ethers.parseEther("0.01"); // researcher stake per submission
  const DISCLOSURE_WINDOW = 90 * 24 * 60 * 60; // 90 days, in seconds

  // 1. Vulnerability Registry
  const Registry = await hre.ethers.getContractFactory("VulnerabilityRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  console.log("VulnerabilityRegistry deployed to:", await registry.getAddress());

  // 2. Stake Manager
  const StakeManager = await hre.ethers.getContractFactory("StakeManager");
  const stakeManager = await StakeManager.deploy(await registry.getAddress(), REQUIRED_STAKE);
  await stakeManager.waitForDeployment();
  console.log("StakeManager deployed to:", await stakeManager.getAddress());

  // 3. Bounty Escrow
  const BountyEscrow = await hre.ethers.getContractFactory("BountyEscrow");
  const escrow = await BountyEscrow.deploy(await registry.getAddress(), arbitrator.address);
  await escrow.waitForDeployment();
  console.log("BountyEscrow deployed to:", await escrow.getAddress());

  // 4. Disclosure Timer
  const DisclosureTimer = await hre.ethers.getContractFactory("DisclosureTimer");
  const timer = await DisclosureTimer.deploy(
    await registry.getAddress(),
    await escrow.getAddress(),
    DISCLOSURE_WINDOW
  );
  await timer.waitForDeployment();
  console.log("DisclosureTimer deployed to:", await timer.getAddress());

  // Wire the registry up to recognize the other contracts
  const tx = await registry.setLinkedContracts(
    await stakeManager.getAddress(),
    await escrow.getAddress(),
    await timer.getAddress()
  );
  await tx.wait();
  console.log("Registry linked to StakeManager, BountyEscrow, and DisclosureTimer.");

  console.log("\nDeployment summary:");
  console.log({
    VulnerabilityRegistry: await registry.getAddress(),
    StakeManager: await stakeManager.getAddress(),
    BountyEscrow: await escrow.getAddress(),
    DisclosureTimer: await timer.getAddress(),
    arbitrator: arbitrator.address,
    requiredStakeWei: REQUIRED_STAKE.toString(),
    disclosureWindowSeconds: DISCLOSURE_WINDOW,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
