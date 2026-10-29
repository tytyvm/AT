import { prisma } from "@/lib/db";
import { getChain, txUrl } from "@/chains";

export const dynamic = "force-dynamic";

// Phase 1 debug view: latest indexed events + indexer lag. Real UI comes later.
export default async function Home() {
  const chain = getChain(4663);
  const [events, cursor] = await Promise.all([
    prisma.chainEvent.findMany({ orderBy: { timestamp: "desc" }, take: 50 }),
    prisma.indexerCursor.findUnique({ where: { chainId: chain.id } }),
  ]);
  const lag = cursor ? Number(cursor.headBlock - cursor.lastBlock) : null;
  return (
    <main>
      <h1>Agentic Wallet Tracker</h1>
      <p>{chain.name} · indexer lag: {lag === null ? "not started" : `${lag} blocks (~${((lag * chain.blockTimeMs) / 1000).toFixed(1)}s)`}</p>
      <table cellPadding={6}>
        <thead><tr><th>Time</th><th>Wallet</th><th>Kind</th><th>Protocol</th><th>Tx</th></tr></thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{e.timestamp.toISOString()}</td>
              <td>{e.wallet.slice(0, 10)}…</td>
              <td>{e.kind}</td>
              <td>{e.protocol ?? ""}</td>
              <td><a href={txUrl(chain, e.txHash)} target="_blank">{e.txHash.slice(0, 10)}…</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
