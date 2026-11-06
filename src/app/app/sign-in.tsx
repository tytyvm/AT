"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { stringToHex, type Hex } from "viem";
import { continueAsGuest, finishWalletSignIn, startWalletSignIn } from "./actions";

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

/** Wallet sign-in button. On a guest session it upgrades the workspace in place, keeping its wallets. */
export function ConnectWallet({ label = "Connect wallet →", solid = true }: { label?: string; solid?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect() {
    setError(null);
    const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
    if (!eth) {
      setError("No browser wallet found. Install one (MetaMask, Rabby, Coinbase Wallet), or continue anonymously.");
      return;
    }
    setBusy(true);
    try {
      setStatus("Waiting for your wallet…");
      const [address] = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const start = await startWalletSignIn(address);
      if (!start.message) throw new Error(start.error);
      setStatus("Approve the signature request. It’s free and moves nothing.");
      const signature = (await eth.request({ method: "personal_sign", params: [stringToHex(start.message), address] })) as Hex;
      setStatus("Checking signature…");
      const done = await finishWalletSignIn(start.message, signature);
      if (done.error) throw new Error(done.error);
      setStatus(null);
      router.refresh();
    } catch (e) {
      const code = (e as { code?: number }).code;
      setError(code === 4001 ? "You cancelled the request in your wallet." : (e as Error).message || "Sign-in failed. Try again.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="connect">
      <button className={`btn ${solid ? "btn-solid" : "btn-line"}`} onClick={connect} disabled={busy}>{busy ? "Connecting…" : label}</button>
      {status && <p className="gate-status" role="status">{status}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

export function SignIn() {
  return (
    <div className="gate">
      <span className="label">Launch · Agentic Wallet Tracker</span>
      <h1>Open your watchlist.</h1>
      <p className="gate-lede">No email, no password. Prove you own a wallet with a free signature, or skip that and stay anonymous.</p>

      <div className="gate-options">
        <div className="gate-option">
          <span className="who">Recommended</span>
          <h2>Connect a wallet</h2>
          <p>Your watchlist follows you to any device. You sign a message, never a transaction. Later, this is how token holders unlock access.</p>
          <ConnectWallet />
        </div>
        <form className="gate-option" action={continueAsGuest}>
          <span className="who">Zero footprint</span>
          <h2>Continue anonymously</h2>
          <p>Nothing about you is stored. Your watchlist lives in this browser, and clearing its cookies ends it. You can connect a wallet later and keep your list.</p>
          <button className="btn btn-line" type="submit">Continue anonymously</button>
        </form>
      </div>
    </div>
  );
}
