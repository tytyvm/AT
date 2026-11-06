import { isAddress } from "viem";
import { CHAINS, type ChainConfig } from "@/chains";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Decodes base58 (Bitcoin alphabet, as Solana uses). Returns null on an invalid character. */
export function base58Decode(s: string): Uint8Array | null {
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  const bytes: number[] = []; // little-endian
  for (const ch of s.slice(zeros)) {
    let carry = B58.indexOf(ch);
    if (carry < 0) return null;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  return Uint8Array.from([...new Array(zeros).fill(0), ...bytes.reverse()]);
}

/** A Solana address is 32 bytes of base58 (32–44 characters). */
export function isSolanaAddress(s: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return false;
  return base58Decode(s)?.length === 32;
}

export function isValidAddress(chain: ChainConfig, s: string): boolean {
  return chain.family === "evm" ? isAddress(s, { strict: false }) : isSolanaAddress(s);
}

/** EVM addresses are case-insensitive and stored lowercase; Solana addresses are case-sensitive and kept as-is. */
export function normalizeAddress(chain: ChainConfig, s: string): string {
  return chain.family === "evm" ? s.toLowerCase() : s;
}

/** Guesses the chain from an address's format: 0x… is EVM (Robinhood Chain), base58 is Solana. */
export function detectChain(s: string): ChainConfig | null {
  const families = s.startsWith("0x") ? ["evm"] : ["solana"];
  return Object.values(CHAINS).find((c) => families.includes(c.family) && isValidAddress(c, s)) ?? null;
}

export const shortAddress = (a: string) => `${a.slice(0, a.startsWith("0x") ? 6 : 4)}…${a.slice(-4)}`;
