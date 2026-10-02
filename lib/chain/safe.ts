import type { ChainEngine } from "./types";

/**
 * Reads a balance for display. Returns null when the network cannot be reached or is
 * slow to answer (for example while it is rate-limiting), so pages still load quickly.
 */
export async function safeBalance(engine: ChainEngine, wallet: string, patienceMs = 6_000): Promise<number | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const gaveUp = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), patienceMs);
  });
  const read = engine.balanceOf(wallet).catch((err) => {
    console.error("Could not read a balance:", err instanceof Error ? err.message : err);
    return null;
  });
  try {
    return await Promise.race([read, gaveUp]);
  } finally {
    clearTimeout(timer);
  }
}
