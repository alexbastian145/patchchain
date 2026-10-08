// Encrypts/decrypts vulnerability report content with AES-256-GCM before it
// ever touches IPFS. Only the resulting ciphertext is uploaded; the key lives
// only in this backend's environment (and, operationally, would be shared
// out-of-band with the organization once a report is validated/disclosed).
const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const keyHex = process.env.REPORT_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      "REPORT_ENCRYPTION_KEY must be set in .env as a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypts a plaintext report (string or Buffer) and returns a single
 * self-contained Buffer: [12-byte IV][16-byte authTag][ciphertext].
 */
function encryptReport(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const input = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, "utf8");
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Reverses encryptReport(). Expects the same [iv][authTag][ciphertext] layout.
 */
function decryptReport(payload) {
  const key = getKey();
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** keccak256-compatible hash (via ethers) is computed where ethers is available;
 * this helper provides a plain sha256 fallback if ever needed outside ethers context. */
function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

module.exports = { encryptReport, decryptReport, sha256Hex };
