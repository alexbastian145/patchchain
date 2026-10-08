// Prints deployment and key-operation gas costs — useful for the Review 2/3 report.
const hre = require("hardhat");

async function main() {
  const [deployer, researcher, organization, arbitrator] = await hre.ethers.getSigners();
  const REQUIRED_STAKE = hre.ethers.parseEther("0.01");
  const DISCLOSURE_WINDOW = 90 * 24 * 60 * 60;

  const results = [];

  async function deployAndMeasure(name, factory, args) {
    const contract = await factory.deploy(...args);
    const receipt = await contract.deploymentTransaction().wait();
    results.push({ action: `Deploy ${name}`, gasUsed: receipt.gasUsed.toString() });
    return contract;
  }

  const Registry = await hre.ethers.getContractFactory("VulnerabilityRegistry");
  const registry = await deployAndMeasure("VulnerabilityRegistry", Registry, []);

  const StakeManager = await hre.ethers.getContractFactory("StakeManager");
  const stakeManager = await deployAndMeasure("StakeManager", StakeManager, [
    await registry.getAddress(),
    REQUIRED_STAKE,
  ]);

  const BountyEscrow = await hre.ethers.getContractFactory("BountyEscrow");
  const escrow = await deployAndMeasure("BountyEscrow", BountyEscrow, [
    await registry.getAddress(),
    arbitrator.address,
  ]);

  const DisclosureTimer = await hre.ethers.getContractFactory("DisclosureTimer");
  const timer = await deployAndMeasure("DisclosureTimer", DisclosureTimer, [
    await registry.getAddress(),
    await escrow.getAddress(),
    DISCLOSURE_WINDOW,
  ]);

  let tx = await registry.setLinkedContracts(
    await stakeManager.getAddress(),
    await escrow.getAddress(),
    await timer.getAddress()
  );
  let receipt = await tx.wait();
  results.push({ action: "setLinkedContracts", gasUsed: receipt.gasUsed.toString() });

  const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("gas-report-sample"));
  tx = await stakeManager
    .connect(researcher)
    .submitReportWithStake(organization.address, hash, "sample-cid", { value: REQUIRED_STAKE });
  receipt = await tx.wait();
  results.push({ action: "submitReportWithStake", gasUsed: receipt.gasUsed.toString() });

  tx = await escrow.connect(organization).fund({ value: hre.ethers.parseEther("1") });
  receipt = await tx.wait();
  results.push({ action: "fund (escrow)", gasUsed: receipt.gasUsed.toString() });

  tx = await escrow.connect(organization).setBountyTier(3, hre.ethers.parseEther("0.2"));
  receipt = await tx.wait();
  results.push({ action: "setBountyTier", gasUsed: receipt.gasUsed.toString() });

  tx = await escrow.connect(organization).approveAndPay(0, 3);
  receipt = await tx.wait();
  results.push({ action: "approveAndPay", gasUsed: receipt.gasUsed.toString() });

  tx = await stakeManager.connect(organization).refundStake(0);
  receipt = await tx.wait();
  results.push({ action: "refundStake", gasUsed: receipt.gasUsed.toString() });

  console.log("\nPatchChain Gas Report\n" + "=".repeat(40));
  for (const r of results) {
    console.log(`${r.action.padEnd(28)} ${r.gasUsed.padStart(10)} gas`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
