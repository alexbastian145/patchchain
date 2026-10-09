const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PatchChain — full lifecycle", function () {
  let registry, stakeManager, escrow, timer;
  let deployer, researcher, organization, arbitrator, other;

  const REQUIRED_STAKE = ethers.parseEther("0.01");
  const DISCLOSURE_WINDOW = 90 * 24 * 60 * 60; // 90 days

  const SAMPLE_HASH = ethers.keccak256(ethers.toUtf8Bytes("sample-encrypted-report-content"));
  const SAMPLE_CID = "bafybeigdyrztoken000samplecid0000000000000000000";

  beforeEach(async function () {
    [deployer, researcher, organization, arbitrator, other] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("VulnerabilityRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await StakeManager.deploy(await registry.getAddress(), REQUIRED_STAKE);
    await stakeManager.waitForDeployment();

    const BountyEscrow = await ethers.getContractFactory("BountyEscrow");
    escrow = await BountyEscrow.deploy(await registry.getAddress(), arbitrator.address);
    await escrow.waitForDeployment();

    const DisclosureTimer = await ethers.getContractFactory("DisclosureTimer");
    timer = await DisclosureTimer.deploy(
      await registry.getAddress(),
      await escrow.getAddress(),
      DISCLOSURE_WINDOW
    );
    await timer.waitForDeployment();

    await registry.setLinkedContracts(
      await stakeManager.getAddress(),
      await escrow.getAddress(),
      await timer.getAddress()
    );
  });

  describe("VulnerabilityRegistry", function () {
    it("stores a submitted report with correct hash, CID, and timestamp", async function () {
      const tx = await registry
        .connect(researcher)
        .submitReport(organization.address, SAMPLE_HASH, SAMPLE_CID);
      await expect(tx).to.emit(registry, "ReportSubmitted");

      const report = await registry.getReport(0);
      expect(report.researcher).to.equal(researcher.address);
      expect(report.organization).to.equal(organization.address);
      expect(report.reportHash).to.equal(SAMPLE_HASH);
      expect(report.ipfsCID).to.equal(SAMPLE_CID);
      expect(report.status).to.equal(0); // Submitted
    });

    it("rejects a submission with an empty hash", async function () {
      await expect(
        registry.connect(researcher).submitReport(organization.address, ethers.ZeroHash, SAMPLE_CID)
      ).to.be.revertedWith("Registry: empty hash");
    });

    it("blocks status updates from unauthorized callers", async function () {
      await registry.connect(researcher).submitReport(organization.address, SAMPLE_HASH, SAMPLE_CID);
      await expect(registry.connect(other).updateStatus(0, 2)).to.be.revertedWith(
        "Registry: not authorized"
      );
    });
  });

  describe("StakeManager", function () {
    it("accepts a report submission with the correct stake", async function () {
      await expect(
        stakeManager
          .connect(researcher)
          .submitReportWithStake(organization.address, SAMPLE_HASH, SAMPLE_CID, {
            value: REQUIRED_STAKE,
          })
      ).to.emit(stakeManager, "StakeDeposited");

      expect(await stakeManager.stakeState(0)).to.equal(1); // Staked
      expect(await ethers.provider.getBalance(await stakeManager.getAddress())).to.equal(
        REQUIRED_STAKE
      );
    });

    it("rejects submission with incorrect stake amount", async function () {
      await expect(
        stakeManager
          .connect(researcher)
          .submitReportWithStake(organization.address, SAMPLE_HASH, SAMPLE_CID, {
            value: ethers.parseEther("0.001"),
          })
      ).to.be.revertedWith("StakeManager: incorrect stake amount");
    });

    it("refunds the stake to the researcher when the organization validates", async function () {
      await stakeManager
        .connect(researcher)
        .submitReportWithStake(organization.address, SAMPLE_HASH, SAMPLE_CID, {
          value: REQUIRED_STAKE,
        });

      const balanceBefore = await ethers.provider.getBalance(researcher.address);
      await expect(stakeManager.connect(organization).refundStake(0)).to.emit(
        stakeManager,
        "StakeRefunded"
      );
      const balanceAfter = await ethers.provider.getBalance(researcher.address);

      expect(balanceAfter - balanceBefore).to.equal(REQUIRED_STAKE);
      expect(await stakeManager.stakeState(0)).to.equal(2); // Refunded
    });

    it("forfeits the stake to the organization on a rejected/spam report", async function () {
      await stakeManager
        .connect(researcher)
        .submitReportWithStake(organization.address, SAMPLE_HASH, SAMPLE_CID, {
          value: REQUIRED_STAKE,
        });

      const balanceBefore = await ethers.provider.getBalance(organization.address);
      const tx = await stakeManager.connect(organization).forfeitStake(0);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(organization.address);

      expect(balanceAfter - balanceBefore + gasCost).to.equal(REQUIRED_STAKE);
      expect(await stakeManager.stakeState(0)).to.equal(3); // Forfeited
    });
  });

  describe("BountyEscrow", function () {
    beforeEach(async function () {
      await registry.connect(researcher).submitReport(organization.address, SAMPLE_HASH, SAMPLE_CID);
      await escrow.connect(organization).fund({ value: ethers.parseEther("5") });
      await escrow.connect(organization).setBountyTier(1, ethers.parseEther("0.1")); // Low
      await escrow.connect(organization).setBountyTier(4, ethers.parseEther("2")); // Critical
    });

    it("releases the correct severity-tiered payout on approval", async function () {
      const balanceBefore = await ethers.provider.getBalance(researcher.address);
      await expect(escrow.connect(organization).approveAndPay(0, 4)).to.emit(
        escrow,
        "BountyReleased"
      );
      const balanceAfter = await ethers.provider.getBalance(researcher.address);

      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("2"));

      const report = await registry.getReport(0);
      expect(report.severity).to.equal(4);
      expect(report.status).to.equal(2); // Validated
    });

    it("prevents paying out twice for the same report", async function () {
      await escrow.connect(organization).approveAndPay(0, 1);
      await expect(escrow.connect(organization).approveAndPay(0, 1)).to.be.revertedWith(
        "Escrow: already settled"
      );
    });

    it("rejects approval from a non-organization address", async function () {
      await expect(escrow.connect(other).approveAndPay(0, 1)).to.be.revertedWith(
        "Escrow: not the organization"
      );
    });

    it("routes disputes to the arbitrator and allows forced payout", async function () {
      await escrow.connect(researcher).raiseDispute(0);
      expect(await escrow.payoutState(0)).to.equal(2); // Disputed

      await expect(
        escrow.connect(arbitrator).resolveDispute(0, true, 4)
      ).to.emit(escrow, "BountyReleased");

      const report = await registry.getReport(0);
      expect(report.severity).to.equal(4);
    });

    it("allows the arbitrator to reject a disputed report with no payout", async function () {
      await escrow.connect(organization).raiseDispute(0);
      await expect(escrow.connect(arbitrator).resolveDispute(0, false, 0)).to.emit(
        escrow,
        "DisputeResolved"
      );

      const report = await registry.getReport(0);
      expect(report.status).to.equal(3); // Rejected
    });
  });

  describe("DisclosureTimer", function () {
    beforeEach(async function () {
      await registry.connect(researcher).submitReport(organization.address, SAMPLE_HASH, SAMPLE_CID);
      await timer.connect(researcher).startTimer(0);
    });

    it("does not allow disclosure before the deadline", async function () {
      await expect(timer.triggerAutoDisclosure(0)).to.be.revertedWith(
        "Timer: deadline not reached"
      );
    });

    it("auto-discloses once the deadline passes with no settlement", async function () {
      await time.increase(DISCLOSURE_WINDOW + 1);

      await expect(timer.triggerAutoDisclosure(0)).to.emit(timer, "AutoDisclosed");

      const report = await registry.getReport(0);
      expect(report.status).to.equal(4); // Disclosed
    });

    it("blocks auto-disclosure if the report was already paid out", async function () {
      await escrow.connect(organization).fund({ value: ethers.parseEther("1") });
      await escrow.connect(organization).setBountyTier(1, ethers.parseEther("0.1"));
      await escrow.connect(organization).approveAndPay(0, 1);

      await time.increase(DISCLOSURE_WINDOW + 1);

      await expect(timer.triggerAutoDisclosure(0)).to.be.revertedWith("Timer: already settled");
    });

    it("reports correct remaining time before and after advancing", async function () {
      const remaining = await timer.timeRemaining(0);
      expect(remaining).to.be.closeTo(BigInt(DISCLOSURE_WINDOW), 5n);

      await time.increase(DISCLOSURE_WINDOW + 10);
      expect(await timer.timeRemaining(0)).to.equal(0);
    });
  });

  describe("End-to-end happy path", function () {
    it("submit (staked) -> validate -> payout -> stake refund", async function () {
      // 1. Researcher submits with stake
      await stakeManager
        .connect(researcher)
        .submitReportWithStake(organization.address, SAMPLE_HASH, SAMPLE_CID, {
          value: REQUIRED_STAKE,
        });

      // 2. Organization funds escrow and sets tiers
      await escrow.connect(organization).fund({ value: ethers.parseEther("3") });
      await escrow.connect(organization).setBountyTier(3, ethers.parseEther("1")); // High

      // 3. Organization validates and pays out
      await escrow.connect(organization).approveAndPay(0, 3);

      // 4. Organization refunds the researcher's stake
      await stakeManager.connect(organization).refundStake(0);

      const report = await registry.getReport(0);
      expect(report.status).to.equal(2); // Validated
      expect(report.severity).to.equal(3);
      expect(await stakeManager.stakeState(0)).to.equal(2); // Refunded
    });
  });
});
