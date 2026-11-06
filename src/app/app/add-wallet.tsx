"use client";

import { useActionState, useEffect, useRef } from "react";
import { addWallet, type AddWalletState } from "./actions";

export function AddWalletForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<AddWalletState, FormData>(addWallet, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.added) form.current?.reset(); }, [state]);

  return (
    <form ref={form} action={action} className="add-wallet">
      <label>
        <span className="label">Wallet address</span>
        <input name="address" placeholder="0x… or Solana address" autoComplete="off" spellCheck={false} required disabled={disabled} />
        <span className="hint">Robinhood Chain or Solana, detected automatically. Bots that trade through their own contract: watch the contract.</span>
      </label>
      <label>
        <span className="label">Label <em>(optional)</em></span>
        <input name="label" placeholder="whale #1" maxLength={40} autoComplete="off" disabled={disabled} />
      </label>
      <button className="btn btn-solid" type="submit" disabled={pending || disabled}>{pending ? "Adding…" : "Watch wallet +"}</button>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.added && <p className="form-ok" role="status">Watching “{state.added}”. New activity appears below.</p>}
    </form>
  );
}
