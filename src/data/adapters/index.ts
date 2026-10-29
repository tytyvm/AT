import type { ChainConfig } from "@/chains";
import type { ChainDataAdapter } from "./types";
import { RpcAdapter } from "./rpc";
import { AlchemyAdapter } from "./alchemy";

export function makeAdapter(chain: ChainConfig): ChainDataAdapter {
  const kind = process.env.DATA_ADAPTER ?? "alchemy";
  if (kind === "alchemy" && chain.alchemyNetwork && process.env.ALCHEMY_API_KEY) {
    return new AlchemyAdapter(chain, process.env.ALCHEMY_API_KEY);
  }
  return new RpcAdapter(chain);
}
export type { ChainDataAdapter };
