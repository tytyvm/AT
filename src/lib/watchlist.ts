import { detectChain, normalizeAddress, shortAddress } from "./address";

export const MAX_WALLETS_PER_USER = 25;
export const MAX_LABEL_LENGTH = 40;

// Addresses that are valid but can't belong to a person: EVM zero address, Solana system program.
const NOT_A_WALLET = new Set(["0x0000000000000000000000000000000000000000", "11111111111111111111111111111111"]);

export type WalletInput = { ok: true; chainId: number; address: string; label: string } | { ok: false; error: string };

/**
 * Validates and normalizes a wallet the user wants to watch. The chain is detected from the format:
 * 0x… is Robinhood Chain, base58 is Solana. EVM addresses are stored lowercase, Solana's exactly as typed.
 */
export function parseWalletInput(rawAddress: unknown, rawLabel: unknown): WalletInput {
  const raw = String(rawAddress ?? "").trim();
  const label = String(rawLabel ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return { ok: false, error: "Paste a wallet address." };
  const chain = detectChain(raw);
  if (!chain) return { ok: false, error: "That isn't a valid Robinhood Chain (0x…) or Solana address." };
  const address = normalizeAddress(chain, raw);
  if (NOT_A_WALLET.has(address)) return { ok: false, error: "That address can't be watched." };
  if (label.length > MAX_LABEL_LENGTH) return { ok: false, error: `Keep the label under ${MAX_LABEL_LENGTH} characters.` };
  return { ok: true, chainId: chain.id, address, label: label || shortAddress(raw) };
}
