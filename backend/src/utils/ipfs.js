// Minimal Pinata client — uploads encrypted report buffers to IPFS and fetches
// them back by CID. Pinata's free tier is used instead of running a local IPFS
// node, since that's simplest for a student project / testnet deployment.
const FormData = require("form-data");
const fetch = require("node-fetch");

const PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs";

async function uploadToIPFS(buffer, filename = "report.enc") {
  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("PINATA_API_KEY / PINATA_API_SECRET must be set in .env");
  }

  const form = new FormData();
  form.append("file", buffer, { filename });

  const response = await fetch(PINATA_PIN_URL, {
    method: "POST",
    headers: {
      pinata_api_key: apiKey,
      pinata_secret_api_key: apiSecret,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pinata upload failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.IpfsHash; // the CID
}

async function fetchFromIPFS(cid) {
  const response = await fetch(`${PINATA_GATEWAY}/${cid}`);
  if (!response.ok) {
    throw new Error(`IPFS fetch failed (${response.status}) for CID ${cid}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = { uploadToIPFS, fetchFromIPFS };
