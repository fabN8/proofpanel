/**
 * Simulation engine: no blockchain, balances live in the database.
 * It follows the same rules as the real engines so the app can be tried with zero setup.
 */
import { getDb, newId, num } from "@/lib/db";
import { UserError } from "@/lib/types";
import type { ChainEngine, SignerWallet, StudyOnChain } from "./types";

const PLATFORM = "mock:platform";

async function balance(account: string): Promise<number> {
  const db = await getDb();
  const rows = await db.query<{ amount: unknown }>("SELECT amount FROM mock_balances WHERE account = $1", [account]);
  return rows.length ? num(rows[0].amount) : 0;
}

async function add(account: string, delta: number): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO mock_balances (account, amount) VALUES ($1, $2)
     ON CONFLICT (account) DO UPDATE SET amount = mock_balances.amount + $2`,
    [account, delta],
  );
}

async function move(from: string, to: string, amount: number): Promise<void> {
  if ((await balance(from)) < amount) throw new UserError("Not enough test USDC.", "insufficient_funds");
  await add(from, -amount);
  await add(to, amount);
}

const vaultOf = (study: StudyOnChain) => `mock:vault:${study.studyId}`;

export function createMockEngine(): ChainEngine {
  return {
    name: "mock",
    live: false,
    platformAddress: () => PLATFORM,
    balanceOf: (wallet) => balance(wallet),
    async faucet(toWallet, amountBase) {
      await add(toWallet, amountBase);
      return `mock-${newId()}`;
    },
    async lockBudget(study: StudyOnChain, researcher: SignerWallet) {
      const total = study.rewardBase * study.maxParticipants;
      await move(researcher.address, vaultOf(study), total);
      return { chainRef: vaultOf(study), tx: `mock-${newId()}` };
    },
    async payParticipant(study, participantWallet) {
      const db = await getDb();
      const vault = vaultOf(study);
      const inserted = await db.query(
        `INSERT INTO mock_receipts (study_ref, wallet) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING wallet`,
        [vault, participantWallet],
      );
      if (!inserted.length) throw new UserError("This wallet was already paid for this study.", "already_paid");
      try {
        await move(vault, participantWallet, study.rewardBase);
      } catch (err) {
        await db.query("DELETE FROM mock_receipts WHERE study_ref = $1 AND wallet = $2", [vault, participantWallet]);
        throw err;
      }
      return `mock-${newId()}`;
    },
    async closeStudy(study, researcher) {
      const vault = vaultOf(study);
      const left = await balance(vault);
      if (left > 0) await move(vault, researcher.address, left);
      return { tx: `mock-${newId()}`, refundedBase: left };
    },
    vaultBalance: (study) => balance(vaultOf(study)),
  };
}
