import { isAddress } from "viem";

export const MAX_WALLETS_PER_USER = 25;
export const MAX_LABEL_LENGTH = 40;

export type WalletInput = { ok: true; address: string; label: string } | { ok: false; error: string };

/** Validates and normalizes a wallet the user wants to watch. Addresses are stored lowercase. */
export function parseWalletInput(rawAddress: unknown, rawLabel: unknown): WalletInput {
  const address = String(rawAddress ?? "").trim();
  const label = String(rawLabel ?? "").trim().replace(/\s+/g, " ");
  if (!address) return { ok: false, error: "Paste a wallet address." };
  if (!isAddress(address, { strict: false })) return { ok: false, error: "That isn't a valid 0x address." };
  if (/^0x0{40}$/i.test(address)) return { ok: false, error: "The zero address can't be watched." };
  if (label.length > MAX_LABEL_LENGTH) return { ok: false, error: `Keep the label under ${MAX_LABEL_LENGTH} characters.` };
  return { ok: true, address: address.toLowerCase(), label: label || `${address.slice(0, 6)}…${address.slice(-4)}` };
}
