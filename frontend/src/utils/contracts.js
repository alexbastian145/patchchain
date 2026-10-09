import { Contract } from "ethers";
import { CONTRACT_ADDRESSES } from "../config";

import registryAbi from "../abis/VulnerabilityRegistry.json";
import stakeManagerAbi from "../abis/StakeManager.json";
import escrowAbi from "../abis/BountyEscrow.json";
import timerAbi from "../abis/DisclosureTimer.json";

/**
 * Builds ethers Contract instances bound to the connected wallet's signer.
 * Call this fresh whenever the signer changes (new account/network).
 */
export function getContracts(signer) {
  if (!signer) return null;

  return {
    registry: new Contract(CONTRACT_ADDRESSES.registry, registryAbi.abi, signer),
    stakeManager: new Contract(CONTRACT_ADDRESSES.stakeManager, stakeManagerAbi.abi, signer),
    escrow: new Contract(CONTRACT_ADDRESSES.escrow, escrowAbi.abi, signer),
    timer: new Contract(CONTRACT_ADDRESSES.disclosureTimer, timerAbi.abi, signer),
  };
}
