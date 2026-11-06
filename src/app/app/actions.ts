"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAddress, isAddress, verifyMessage, type Hex } from "viem";
import { createSiweMessage, generateSiweNonce, parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getSessionUser } from "@/lib/session";
import { MAX_WALLETS_PER_USER, parseWalletInput } from "@/lib/watchlist";

const SIWE_CHAIN_ID = 4663; // Robinhood Chain: the chain named in the Sign-In with Ethereum message
const NONCE_COOKIE = "awt_siwe_nonce";

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { domain: host, uri: `${proto}://${host}` };
}

/** Step 1 of wallet sign-in: build the message the wallet will sign. */
export async function startWalletSignIn(address: string): Promise<{ message?: string; error?: string }> {
  if (!isAddress(address, { strict: false })) return { error: "Your wallet returned an invalid address." };
  const nonce = generateSiweNonce();
  (await cookies()).set(NONCE_COOKIE, nonce, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 600,
  });
  const { domain, uri } = await origin();
  const message = createSiweMessage({
    address: getAddress(address),
    chainId: SIWE_CHAIN_ID,
    domain,
    uri,
    nonce,
    version: "1",
    statement: "Sign in to Agentic Wallet Tracker. This is free, sends no transaction and grants no spending rights.",
    issuedAt: new Date(),
    expirationTime: new Date(Date.now() + 10 * 60_000),
  });
  return { message };
}

/** Step 2: check the signature, then sign the user in. A guest session is upgraded in place. */
export async function finishWalletSignIn(message: string, signature: Hex): Promise<{ error?: string }> {
  const jar = await cookies();
  const nonce = jar.get(NONCE_COOKIE)?.value;
  jar.delete(NONCE_COOKIE);
  if (!nonce) return { error: "Sign-in timed out. Try again." };

  const parsed = parseSiweMessage(message);
  const { domain } = await origin();
  if (!parsed.address || !validateSiweMessage({ message: parsed, domain, nonce })) {
    return { error: "That sign-in request isn't valid for this site. Try again." };
  }
  const valid = await verifyMessage({ address: parsed.address, message, signature }).catch(() => false);
  if (!valid) return { error: "The signature didn't match your wallet." };

  const walletAddress = parsed.address.toLowerCase();
  const current = await getSessionUser();
  const existing = await prisma.user.findUnique({ where: { walletAddress } });
  let userId: string;
  if (existing) {
    userId = existing.id;
    // Signing in from a guest workspace: carry its wallets over.
    if (current && !current.walletAddress && current.id !== existing.id) {
      const guestWallets = await prisma.watchedWallet.findMany({ where: { userId: current.id } });
      await prisma.watchedWallet.createMany({
        data: guestWallets.map(({ chainId, address, label }) => ({ userId, chainId, address, label })),
        skipDuplicates: true,
      });
    }
  } else if (current && !current.walletAddress) {
    userId = (await prisma.user.update({ where: { id: current.id }, data: { walletAddress } })).id;
  } else {
    userId = (await prisma.user.create({ data: { walletAddress } })).id;
  }

  await destroySession();
  await createSession(userId);
  revalidatePath("/app");
  return {};
}

export async function continueAsGuest() {
  const user = await prisma.user.create({ data: {} });
  await createSession(user.id);
  redirect("/app");
}

export async function signOut() {
  await destroySession();
  redirect("/app");
}

export type AddWalletState = { error?: string; added?: string };

export async function addWallet(_prev: AddWalletState, form: FormData): Promise<AddWalletState> {
  const user = await getSessionUser();
  if (!user) return { error: "Your session ended. Sign in again." };
  const input = parseWalletInput(form.get("address"), form.get("label"));
  if (!input.ok) return { error: input.error };

  const count = await prisma.watchedWallet.count({ where: { userId: user.id } });
  if (count >= MAX_WALLETS_PER_USER) return { error: `You can watch up to ${MAX_WALLETS_PER_USER} wallets for now.` };

  const exists = await prisma.watchedWallet.findUnique({
    where: { userId_chainId_address: { userId: user.id, chainId: input.chainId, address: input.address } },
  });
  if (exists) return { error: `You're already watching that wallet as “${exists.label}”.` };

  await prisma.watchedWallet.create({ data: { userId: user.id, chainId: input.chainId, address: input.address, label: input.label } });
  revalidatePath("/app");
  return { added: input.label };
}

export async function removeWallet(form: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  await prisma.watchedWallet.deleteMany({ where: { id: String(form.get("id")), userId: user.id } });
  revalidatePath("/app");
}
