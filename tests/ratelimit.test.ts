/**
 * Runs a real transaction through the real Solana client against a stand-in endpoint
 * that answers the first request of every kind with "429 Too Many Requests",
 * exactly as the public devnet endpoint does when it is busy.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const seen: Record<string, number> = {};
let server: Server;

const answers: Record<string, (params: unknown[]) => unknown> = {
  getLatestBlockhash: () => ({ context: { slot: 1 }, value: { blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 1_000 } }),
  sendTransaction: () => bs58.encode(new Uint8Array(64).fill(7)),
  getSignatureStatuses: () => ({ context: { slot: 2 }, value: [{ slot: 2, confirmations: 1, err: null, confirmationStatus: "confirmed" }] }),
  getBlockHeight: () => 10,
};

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const { id, method, params } = JSON.parse(body);
      seen[method] = (seen[method] ?? 0) + 1;
      if (seen[method] === 1) {
        res.writeHead(429, "Too Many Requests", { "content-type": "application/json" });
        res.end(`{"jsonrpc":"2.0","error":{"code": 429, "message":"Too many requests for a specific RPC call"}, "id": "${id}" }`);
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id, result: answers[method](params) }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.SOLANA_RPC_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.PLATFORM_SECRET_KEY = bs58.encode(Keypair.generate().secretKey);
});

afterAll(() => new Promise<void>((resolve) => void server.close(() => resolve())));

describe("a payment while the endpoint is rate-limiting", () => {
  it("goes through once the endpoint answers again", async () => {
    const { createVaultEngine } = await import("@/lib/chain/vault");
    const engine = createVaultEngine();
    const signature = await engine.faucet(Keypair.generate().publicKey.toBase58(), 1_000_000);

    expect(bs58.decode(signature)).toHaveLength(64);
    // Each kind of request was refused once and then repeated; the transaction was sent exactly twice.
    expect(seen.getLatestBlockhash).toBe(2);
    expect(seen.sendTransaction).toBe(2);
    expect(seen.getSignatureStatuses).toBe(2);
  }, 30_000);
});
