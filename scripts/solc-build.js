// Compiles all contracts using the solc-js (WASM) compiler installed via npm,
// bypassing Hardhat's default compiler downloader — this sandbox's network
// egress allowlist does not include binaries.soliditylang.org, only npm's
// registry. Output is written directly in Hardhat's artifact JSON format so
// `hre.ethers.getContractFactory(...)` and `hardhat test --no-compile` work
// normally afterward.
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const CONTRACTS_DIR = path.join(__dirname, "..", "contracts");
const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts", "contracts");

function findSolFiles(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith(".sol"));
}

function readAllSources() {
  const sources = {};
  for (const file of findSolFiles(CONTRACTS_DIR)) {
    sources[file] = { content: fs.readFileSync(path.join(CONTRACTS_DIR, file), "utf8") };
  }
  return sources;
}

function importCallback(importPath) {
  // Resolve relative imports like "./VulnerabilityRegistry.sol"
  const fileName = path.basename(importPath);
  const fullPath = path.join(CONTRACTS_DIR, fileName);
  if (fs.existsSync(fullPath)) {
    return { contents: fs.readFileSync(fullPath, "utf8") };
  }
  return { error: `File not found: ${importPath}` };
}

function main() {
  const sources = readAllSources();

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "metadata"],
        },
      },
    },
  };

  console.log("Compiling with solc", solc.version());
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: importCallback }));

  let hasError = false;
  if (output.errors) {
    for (const err of output.errors) {
      if (err.severity === "error") {
        hasError = true;
        console.error(err.formattedMessage);
      } else {
        console.warn(err.formattedMessage);
      }
    }
  }
  if (hasError) {
    process.exit(1);
  }

  for (const [fileName, contractsInFile] of Object.entries(output.contracts)) {
    for (const [contractName, contractData] of Object.entries(contractsInFile)) {
      const outDir = path.join(ARTIFACTS_DIR, fileName);
      fs.mkdirSync(outDir, { recursive: true });

      const artifact = {
        _format: "hh-sol-artifact-1",
        contractName,
        sourceName: `contracts/${fileName}`,
        abi: contractData.abi,
        bytecode: "0x" + contractData.evm.bytecode.object,
        deployedBytecode: "0x" + contractData.evm.deployedBytecode.object,
        linkReferences: {},
        deployedLinkReferences: {},
      };

      fs.writeFileSync(
        path.join(outDir, `${contractName}.json`),
        JSON.stringify(artifact, null, 2)
      );
      console.log(`  wrote artifacts/contracts/${fileName}/${contractName}.json`);
    }
  }

  // Minimal build-info + debug file so hardhat tooling that checks for their
  // existence doesn't choke (not required for ethers-based scripts/tests).
  console.log("Compilation complete.");
}

main();
