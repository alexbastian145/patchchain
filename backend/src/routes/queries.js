const express = require("express");
const { ethers } = require("ethers");
const { getContracts } = require("../utils/contracts");

const router = express.Router();

const STATUS = ["Submitted", "Under Review", "Validated", "Rejected", "Disclosed"];

/**
 * Reads every report straight from contract storage (reportCount + getReport)
 * instead of scanning event logs. Free-tier RPC providers (e.g. Alchemy) cap
 * eth_getLogs at a 10-block range, so log scanning from block 0 fails on Sepolia.
 * Storage reads work on any RPC; for large scale, use an indexer instead.
 */
async function loadAllReports(registry) {
  const count = Number(await registry.reportCount());
  const ids = Array.from({ length: count }, (_, i) => i);
  const out = [];
  for (let i = 0; i < ids.length; i += 10) {
    const batch = await Promise.all(
      ids.slice(i, i + 10).map(async (id) => ({ id, r: await registry.getReport(id) }))
    );
    out.push(...batch);
  }
  return out;
}

const sameAddr = (a, b) => a.toLowerCase() === b.toLowerCase();

/**
 * GET /api/organizations/:address/reports
 * Reads registry storage to list all reports addressed to an organization.
 * For a production system this would be backed by an indexer (e.g. The Graph);
 * event log scanning is fine at hackathon/testnet scale.
 */
router.get("/organizations/:address/reports", async (req, res) => {
  try {
    const { registry } = getContracts();
    const address = req.params.address;
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid organization address" });
    }

    const all = await loadAllReports(registry);
    const reports = all
      .filter(({ r }) => sameAddr(r.organization, address))
      .map(({ id, r }) => ({
        reportId: id,
        researcher: r.researcher,
        reportHash: r.reportHash,
        ipfsCID: r.ipfsCID,
        submittedAt: new Date(Number(r.submittedAt) * 1000).toISOString(),
        status: STATUS[Number(r.status)],
        severity: Number(r.severity),
      }));

    res.json({ organization: address, reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/researchers/:address/reports
 * Same idea, filtered by researcher.
 */
router.get("/researchers/:address/reports", async (req, res) => {
  try {
    const { registry } = getContracts();
    const address = req.params.address;
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid researcher address" });
    }

    const all = await loadAllReports(registry);
    const reports = all
      .filter(({ r }) => sameAddr(r.researcher, address))
      .map(({ id, r }) => ({
        reportId: id,
        organization: r.organization,
        submittedAt: new Date(Number(r.submittedAt) * 1000).toISOString(),
        status: STATUS[Number(r.status)],
        severity: Number(r.severity),
      }));

    res.json({ researcher: address, reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/reports/:id/timer
 * Returns the disclosure countdown status for a report.
 */
router.get("/reports/:id/timer", async (req, res) => {
  try {
    const { timer } = getContracts();
    const remaining = await timer.timeRemaining(req.params.id);
    const disclosed = await timer.disclosed(req.params.id);
    res.json({
      reportId: Number(req.params.id),
      secondsRemaining: Number(remaining),
      disclosed,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
