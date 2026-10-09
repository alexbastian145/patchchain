// Full PatchChain demo on an in-memory test chain — no MetaMask, no test ETH, no internet.
// Run:  npx hardhat run scripts/demo-flow.js
const hre = require("hardhat");
const { ethers } = hre;

const eth = (v) => ethers.formatEther(v);
const line = (t) => console.log("\n" + "=".repeat(8) + " " + t + " " + "=".repeat(8));

async function main() {
  const [deployer, researcher, org, arbitrator] = await ethers.getSigners();
  const STAKE = ethers.parseEther("0.01");
  const WINDOW = 90 * 24 * 60 * 60;
  const bal = async (label, s) => console.log(`   ${label.padEnd(11)} balance: ${eth(await ethers.provider.getBalance(s.address))} ETH`);

  line("1. Deploy the 4 contracts");
  const registry = await (await ethers.getContractFactory("VulnerabilityRegistry")).deploy();
  const stakeManager = await (await ethers.getContractFactory("StakeManager")).deploy(await registry.getAddress(), STAKE);
  const escrow = await (await ethers.getContractFactory("BountyEscrow")).deploy(await registry.getAddress(), arbitrator.address);
  const timer = await (await ethers.getContractFactory("DisclosureTimer")).deploy(await registry.getAddress(), await escrow.getAddress(), WINDOW);
  await (await registry.setLinkedContracts(await stakeManager.getAddress(), await escrow.getAddress(), await timer.getAddress())).wait();
  console.log("   VulnerabilityRegistry:", await registry.getAddress());
  console.log("   StakeManager:         ", await stakeManager.getAddress());
  console.log("   BountyEscrow:         ", await escrow.getAddress());
  console.log("   DisclosureTimer:      ", await timer.getAddress());

  line("2. Researcher submits report #0 (hash + CID on-chain, 0.01 ETH stake)");
  const hash0 = ethers.keccak256(ethers.toUtf8Bytes("encrypted report: stored XSS in DemoShop profile bio"));
  const cid0 = "QmDemoEncryptedReportCID0000000000000000000000";
  await bal("Researcher", researcher);
  await (await stakeManager.connect(researcher).submitReportWithStake(org.address, hash0, cid0, { value: STAKE })).wait();
  const r0 = await registry.getReport(0);
  console.log("   researcher:", r0.researcher);
  console.log("   reportHash:", r0.reportHash);
  console.log("   timestamp :", new Date(Number(r0.submittedAt) * 1000).toISOString(), "(immutable proof of discovery)");
  console.log("   status    : Submitted");
  await bal("Researcher", researcher);

  line("3. Organization funds escrow and sets bounty tiers");
  await (await escrow.connect(org).fund({ value: ethers.parseEther("2") })).wait();
  await (await escrow.connect(org).setBountyTier(3, ethers.parseEther("0.5"))).wait(); // High
  console.log("   escrow funded with 2 ETH; High tier = 0.5 ETH");

  line("4. Organization approves report #0 as HIGH -> automatic payout");
  await bal("Researcher", researcher);
  await (await escrow.connect(org).approveAndPay(0, 3)).wait();
  await bal("Researcher", researcher);
  console.log("   status now:", ["Submitted", "UnderReview", "Validated", "Rejected", "Disclosed"][Number((await registry.getReport(0)).status)]);

  line("5. Organization refunds the researcher's stake");
  await (await stakeManager.connect(org).refundStake(0)).wait();
  await bal("Researcher", researcher);

  line("6. Report #1 is ignored by the organization -> automatic disclosure");
  await (await stakeManager.connect(researcher).submitReportWithStake(org.address, ethers.keccak256(ethers.toUtf8Bytes("second report")), "QmDemoEncryptedReportCID1111111111111111111111", { value: STAKE })).wait();
  await (await timer.connect(researcher).startTimer(1)).wait();
  console.log("   timer started; remaining:", Math.round(Number(await timer.timeRemaining(1)) / 86400), "days");
  try { await timer.triggerAutoDisclosure(1); } catch { console.log("   trigger before deadline -> rejected (deadline not reached)"); }
  await hre.network.provider.send("evm_increaseTime", [WINDOW + 1]);
  await hre.network.provider.send("evm_mine");
  console.log("   ... 90 days later (simulated) ...");
  await (await timer.triggerAutoDisclosure(1)).wait();
  console.log("   status now:", ["Submitted", "UnderReview", "Validated", "Rejected", "Disclosed"][Number((await registry.getReport(1)).status)]);

  line("7. Security checks (these must FAIL)");
  const expectFail = async (label, p) => { try { await p; console.log("   ✗ UNEXPECTED SUCCESS:", label); } catch (e) { console.log("   ✓ rejected:", label); } };
  await expectFail("stranger tries to approve a report", escrow.connect(researcher).approveAndPay(1, 3));
  await expectFail("wrong stake amount", stakeManager.connect(researcher).submitReportWithStake(org.address, hash0, cid0, { value: 1 }));
  await expectFail("double payout of report #0", escrow.connect(org).approveAndPay(0, 3));

  console.log("\nDemo complete.");
}
main().catch((e) => { console.error(e); process.exit(1); });
