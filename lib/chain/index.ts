import { engineName } from "@/lib/config";
import type { ChainEngine } from "./types";

let cached: { name: string; engine: ChainEngine } | null = null;

/** The engine is chosen by settings: simulation without a platform key, otherwise vault or escrow. */
export async function getEngine(): Promise<ChainEngine> {
  const name = engineName();
  if (cached && cached.name === name) return cached.engine;
  let engine: ChainEngine;
  if (name === "mock") engine = (await import("./mock")).createMockEngine();
  else if (name === "vault") engine = (await import("./vault")).createVaultEngine();
  else engine = (await import("./escrow")).createEscrowEngine();
  cached = { name, engine };
  return engine;
}

export * from "./types";
