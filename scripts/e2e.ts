/**
 * Runs the whole loop without the web pages: create, fund, start, complete, pay, close.
 * Uses whatever engine the settings select:
 *   - no PLATFORM_SECRET_KEY  -> simulation
 *   - PLATFORM_SECRET_KEY     -> vault engine on devnet
 *   - plus ESCROW_PROGRAM_ID  -> escrow program on devnet
 * It uses a throwaway in-memory database, so it does not touch the app's data.
 */
import "./load-env";

process.env.PGLITE_DIR = "memory";
delete process.env.DATABASE_URL;
process.env.MIN_TIME_FACTOR = "0";

async function main() {
  const { getEngine, explorerTx, explorerAddress } = await import("@/lib/chain");
  const { formatUsdc, toBase } = await import("@/lib/config");
  const studies = await import("@/lib/studies");
  const { signInWithEmail } = await import("@/lib/users");

  const engine = await getEngine();
  const show = (label: string, tx: string | null) => console.log(`  ${label}: ${tx ? (explorerTx(tx) ?? tx) : "-"}`);
  console.log(`Engine: ${engine.name}${engine.live ? " (live on devnet)" : " (simulation)"}`);

  const stamp = Date.now();
  const researcher = await signInWithEmail(`researcher+${stamp}@example.org`);
  const participant = await signInWithEmail(`participant+${stamp}@example.org`);

  console.log("1. Researcher gets test USDC");
  show("faucet", await engine.faucet(researcher.wallet, toBase(1)));

  console.log("2. Create a study: 0.25 USDC x 2 participants");
  let study = await studies.createStudy(researcher, { title: "End-to-end test", surveyUrl: "demo", rewardUsdc: 0.25, maxParticipants: 2, estMinutes: 1 });

  console.log("3. Fund it (budget locked)");
  study = await studies.fundStudy(researcher, study.id);
  show("funding", study.fundTx);
  if (study.chainRef) console.log(`  vault: ${explorerAddress(study.chainRef) ?? study.chainRef}`);

  console.log("4. Participant starts and completes");
  const { surveyUrl } = await studies.startSubmission(participant, study.id);
  const token = new URL(surveyUrl, "http://x").searchParams.get("pid")!;
  const started = Date.now();
  const paid = await studies.completeSubmission(token, study.completionCode);
  console.log(`  paid ${formatUsdc(paid.amountBase)} USDC in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  show("payout", paid.tx);

  console.log("5. A second payout to the same participant is refused");
  const onChain = { studyId: study.id, chainStudyId: study.chainStudyId, researcherWallet: researcher.wallet, rewardBase: study.rewardBase, maxParticipants: study.maxParticipants, chainRef: study.chainRef };
  if (engine.name === "vault") {
    console.log("  skipped: the vault engine relies on the database for this rule (the escrow program enforces it on-chain)");
  } else {
    try {
      await engine.payParticipant(onChain, participant.wallet);
      throw new Error("A second payout went through. This must not happen.");
    } catch (err) {
      if (err instanceof Error && err.message.includes("must not happen")) throw err;
      console.log(`  refused: ${err instanceof Error ? err.message.slice(0, 120) : err}`);
    }
  }

  console.log("6. Close the study (unspent budget returns)");
  const closed = await studies.closeStudy(researcher, study.id);
  console.log(`  refunded ${formatUsdc(closed.refundedBase)} USDC`);
  show("refund", closed.study.closeTx);

  const balances = { researcher: await engine.balanceOf(researcher.wallet), participant: await engine.balanceOf(participant.wallet) };
  console.log(`\nBalances: researcher ${formatUsdc(balances.researcher)} USDC, participant ${formatUsdc(balances.participant)} USDC`);
  const ok = balances.researcher === toBase(0.75) && balances.participant === toBase(0.25) && closed.refundedBase === toBase(0.25);
  console.log(ok ? "RESULT: the whole loop works." : "RESULT: balances are not what was expected. Please send me this output.");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("\nThe run failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
