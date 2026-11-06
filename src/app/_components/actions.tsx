import { addressUrl, CHAINS, txUrl } from "@/chains";
import type { ActionKind, Leg } from "@/data/actions/types";
import { shortAddress } from "@/lib/address";
import { describeAction, usd } from "@/lib/format";

export interface ActionRow {
  id: string;
  chainId: number;
  txHash: string;
  wallet: string;
  timestamp: Date;
  kind: ActionKind;
  venue: string | null;
  counterparty: string | null;
  legs: unknown; // JSON column: Leg[]
  usdValue: { toNumber(): number } | null; // Prisma Decimal
}

export function ChainBadge({ chainId }: { chainId: number }) {
  const chain = CHAINS[chainId];
  return <span className={`chain chain-${chain?.key ?? "unknown"}`}>{chain?.key === "solana" ? "SOL" : chain?.key === "robinhood" ? "RH" : "?"}</span>;
}

/** Newest-first table of actions. `labels` maps "chainId:address" to the user's label for that wallet. */
export function ActionList({ actions, labels }: { actions: ActionRow[]; labels: Map<string, string> }) {
  return (
    <div className="table-scroll">
      <table className="events">
        <thead><tr><th>UTC</th><th>Wallet</th><th>Action</th><th>Value</th><th>Tx</th></tr></thead>
        <tbody>
          {actions.map((a) => {
            const chain = CHAINS[a.chainId];
            const value = a.usdValue ? usd(a.usdValue.toNumber()) : "";
            const other = a.counterparty ? (a.kind === "SEND" ? " to " : " from ") : "";
            return (
              <tr key={a.id}>
                <td title={a.timestamp.toISOString()}>{a.timestamp.toISOString().slice(5, 19).replace("T", " ")}</td>
                <td><ChainBadge chainId={a.chainId} /> {labels.get(`${a.chainId}:${a.wallet}`) ?? shortAddress(a.wallet)}</td>
                <td className={`act act-${a.kind.toLowerCase()}`}>
                  {describeAction(a.kind, a.legs as Leg[])}
                  {other && chain && <>{other}<a href={addressUrl(chain, a.counterparty!)} target="_blank" rel="noreferrer">{shortAddress(a.counterparty!)}</a></>}
                  {a.venue && <span className="venue"> · {a.venue}</span>}
                </td>
                <td>{value || "—"}</td>
                <td>{chain ? <a href={txUrl(chain, a.txHash)} target="_blank" rel="noreferrer">{shortAddress(a.txHash)} ↗</a> : shortAddress(a.txHash)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
