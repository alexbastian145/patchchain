const express = require("express");
const { ethers } = require("ethers");
const { encryptReport, decryptReport } = require("../utils/crypto");
const { uploadToIPFS, fetchFromIPFS } = require("../utils/ipfs");
const { getContracts } = require("../utils/contracts");

const router = express.Router();

/**
 * POST /api/reports
 * body: { organization: "0x...", title, description, stepsToReproduce, ... }
 *
 * Flow: encrypt the full report JSON -> upload ciphertext to IPFS -> hash the
 * ciphertext -> call StakeManager.submitReportWithStake on-chain with the
 * hash + CID. The researcher's wallet (via MetaMask on the frontend) is the
 * one that actually sends the staked transaction — this endpoint only
 * prepares the encrypted payload and returns what the frontend needs to call
 * the contract itself. Keeping the stake transaction client-side means the
 * backend never touches researcher funds.
 */
router.post("/prepare", async (req, res) => {
  try {
    const { organization, ...reportBody } = req.body;
    if (!organization || !ethers.isAddress(organization)) {
      return res.status(400).json({ error: "Valid 'organization' address is required" });
    }
    if (!reportBody.title || !reportBody.description) {
      return res.status(400).json({ error: "'title' and 'description' are required" });
    }

    const plaintext = JSON.stringify({ ...reportBody, preparedAt: new Date().toISOString() });
    const encrypted = encryptReport(plaintext);
    const reportHash = ethers.keccak256(encrypted);
    const cid = await uploadToIPFS(encrypted, `report-${Date.now()}.enc`);

    // Frontend takes these three values and calls
    // stakeManager.submitReportWithStake(organization, reportHash, cid, { value: requiredStake })
    res.json({ organization, reportHash, cid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/:id
 * Reads report metadata from the registry contract. Does NOT decrypt content —
 * that only happens via /:id/decrypt, gated by report status.
 */
router.get("/:id", async (req, res) => {
  try {
    const { registry } = getContracts();
    const report = await registry.getReport(req.params.id);

    res.json({
      reportId: Number(req.params.id),
      researcher: report.researcher,
      organization: report.organization,
      reportHash: report.reportHash,
      ipfsCID: report.ipfsCID,
      submittedAt: new Date(Number(report.submittedAt) * 1000).toISOString(),
      status: ["Submitted", "UnderReview", "Validated", "Rejected", "Disclosed"][report.status],
      severity: Number(report.severity),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/:id/decrypt
 * Only permitted once a report has been Validated or Disclosed on-chain —
 * mirrors PatchChain's confidentiality model: content stays encrypted until
 * the organization has acted (or the disclosure deadline has passed).
 */
router.get("/:id/decrypt", async (req, res) => {
  try {
    const { registry } = getContracts();
    const report = await registry.getReport(req.params.id);
    const statusName = ["Submitted", "UnderReview", "Validated", "Rejected", "Disclosed"][
      report.status
    ];

    if (!["Validated", "Disclosed"].includes(statusName)) {
      return res.status(403).json({
        error: `Report is not yet eligible for decryption (status: ${statusName})`,
      });
    }

    const encrypted = await fetchFromIPFS(report.ipfsCID);

    // Integrity check: the ciphertext fetched from IPFS must match the hash on-chain.
    const computedHash = ethers.keccak256(encrypted);
    if (computedHash !== report.reportHash) {
      return res.status(409).json({ error: "IPFS content does not match on-chain hash — possible tampering" });
    }

    const plaintext = decryptReport(encrypted);
    res.json({ reportId: Number(req.params.id), content: JSON.parse(plaintext) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
