require("dotenv").config({ path: "backend/.env" });
const hre = require("hardhat");
(async () => {
  const { ethers } = hre;
  const [, researcher, org] = await ethers.getSigners(); // accounts #1 and #2
  const stake = await ethers.getContractAt("StakeManager", process.env.STAKE_MANAGER_ADDRESS, researcher);
  const registry = await ethers.getContractAt("VulnerabilityRegistry", process.env.REGISTRY_ADDRESS);
  console.log("code at StakeManager:", (await ethers.provider.getCode(process.env.STAKE_MANAGER_ADDRESS)).length > 2 ? "yes" : "NO CONTRACT");
  console.log("registry.stakeManager():", await registry.stakeManager());
  console.log("expected             :", process.env.STAKE_MANAGER_ADDRESS);
  console.log("balance #1:", ethers.formatEther(await ethers.provider.getBalance(researcher.address)), "ETH");
  try {
    const tx = await stake.submitReportWithStake(org.address, ethers.keccak256("0x1234"), "QmTest", { value: ethers.parseEther("0.01") });
    await tx.wait();
    console.log("SUBMIT OK, report count:", (await registry.reportCount()).toString());
  } catch (e) { console.log("SUBMIT FAILED:", e.shortMessage || e.message); }
})();
