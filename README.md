# ProofPanel

**Pay verified humans for research, seconds after they finish.**

A researcher locks a study budget in an escrow program on Solana. Participants sign in with an
email address, prove once that they are a real person, take the survey, and receive the reward
in their own wallet the moment the survey ends.

- **Live demo:** https://proofpanel.vercel.app
- **Escrow program on devnet:** [`9H58enMtdDK4HPDEwswG5FWRo6j9sswxxt83HZGXk8j4`](https://explorer.solana.com/address/9H58enMtdDK4HPDEwswG5FWRo6j9sswxxt83HZGXk8j4?cluster=devnet)
- **Built for:** Build an MVP with Solana at WHU (Superteam Germany), October 2026

> Status: hackathon prototype. It runs on the Solana test network (devnet) with test money only.

## The problem

Paid online studies fail researchers and participants in three ways:

- **Bots.** An AI agent built to answer surveys evaded detection 99.8% of the time, at about
  5 cents per fake response (Westwood, PNAS, November 2025).
- **Fees.** The leading panel, Prolific, adds 33.3% (academic) or 42.8% (corporate) on top of
  every reward ([pricing](https://www.prolific.com/pricing), read October 2026).
- **Slow pay.** A Prolific submission can wait up to 21 days for approval, and cash-out is
  PayPal only, from £6 or $6 (Prolific help centre, read October 2026).

## How it works

1. **Fund.** The researcher creates a study and locks the full budget (reward × places) in USDC
   in a vault owned by the program.
2. **Verify.** A participant signs in by email, gets a wallet, and proves once that they are a
   person (World ID).
3. **Answer.** They take the survey. A one-time link ties their response to their payout,
   without their name.
4. **Get paid.** The program sends one reward to that wallet. The researcher sees the results
   and exports them with a transaction link per payout.

Before every payout the app checks that the link is unused, the completion code matches, a
minimum time has passed and a place is still free.

## The role of Solana

| Question | With a payment account | With Solana, as built |
| --- | --- | --- |
| Is the money really there? | Trust the platform's word | The budget sits in a vault owned by the program. Anyone can look it up before they start. |
| Can someone be paid twice? | Only the platform's database says no | Each payout creates a receipt for that wallet. A second payout is rejected on-chain. |
| Can 50 cents cross a border? | PayPal only, with a minimum cash-out | USDC goes to a wallet created at email sign-in. The platform pays the network fee. |
| Can a funder audit it? | A statement from the platform | Every payout is a public transaction, linked in the export. |

### The escrow program

`program/src/lib.rs` is an Anchor program, `study_escrow`, deployed on devnet at
[`9H58enMtdDK4HPDEwswG5FWRo6j9sswxxt83HZGXk8j4`](https://explorer.solana.com/address/9H58enMtdDK4HPDEwswG5FWRo6j9sswxxt83HZGXk8j4?cluster=devnet).
It has three instructions:

| Instruction | What it does |
| --- | --- |
| `create_study` | Creates the study account and moves reward × places from the researcher into the vault |
| `payout` | Sends exactly one reward to a participant and creates their receipt |
| `close_study` | Ends the study and returns whatever is left to the researcher |

What the program guarantees: the budget is locked at creation, a payout is always exactly the
reward, a wallet is paid at most once per study, and only the researcher gets the remainder.

What it does not check: whether the participant really finished the survey. That decision is
made off-chain by the platform's key, which is the only key allowed to trigger payouts.

## Try the live demo

You need two browser windows (one of them private) and two email addresses.

**As a researcher**

1. Open https://proofpanel.vercel.app and click **Run a study**. Sign in with your email
   address; you get a one-time code.
2. Create a study with the built-in demo survey.
3. Click **Get 5 test USDC**, then **Fund study**. The study page now links to the vault and
   the funding transaction on Solana Explorer.
4. Copy the participant link.

**As a participant**

5. Open the link in a private window and sign in with a different email address.
6. If the study requires World ID, click **Verify with World ID** and follow the note under
   the button. In test mode, the code is scanned or pasted into World's simulator at
   https://simulator.worldcoin.org instead of the World App.
7. Click **Start survey**, answer the three questions and submit. The next page shows the
   payment and a link to the transaction.

**Back as the researcher**

8. Reload the study page: the completion, the survey results and the payout transaction are
   listed. **Export CSV** gives one row per participant.
9. **Close study and refund** returns the unspent budget.

## What is real and what is not yet

| Part | State |
| --- | --- |
| Budget locking, payouts, refunds in USDC | Real transactions on devnet |
| One payout per participant | Enforced on-chain by the escrow program |
| Sign-in | Email with a one-time code (Privy); each participant gets a Solana wallet only they control |
| Human check | World ID, one verified account per person. In test mode, World's simulator stands in for the World App. |
| Network fees | Paid by the platform wallet; participants never need SOL |
| Researcher funds | Held in an app-controlled test wallet until locked in a study |
| Survey answers | Built-in survey: stored, shown on the study page and included in the CSV export. External survey tool: the tool keeps them; match them to payouts with the `ref` column. Tested with the built-in survey only. |
| Proof of the human check on-chain | Not built yet (planned with the Solana Attestation Service) |
| Real money | Not built: test network and test USDC only |

Known cost: every payout creates a receipt account that holds a small deposit (about 0.0012
SOL). Reclaiming these deposits when a study closes is on the roadmap.

## Roadmap

1. **Invisible crypto.** Researchers pay by card or invoice, participants can cash out to a
   bank account, launch on mainnet.
2. **Trust and quality.** The human check as an on-chain attestation, screening by country,
   language and profile, researcher review for unclear cases.
3. **Scale.** Connectors for common survey tools, receipt deposits reclaimed at study end, an
   API for AI labs and software agents.

## How it is built

Next.js 16 (App Router), TypeScript and Tailwind 4. Postgres through plain SQL: a local file
database (PGlite) on your machine, Neon when hosted. Transactions are built and signed on the
server with `@solana/web3.js` and `@solana/spl-token`.

```
app/                 pages and API routes
components/          interface pieces
lib/
  studies.ts         the rules: create, fund, start, complete, pay, close
  users.ts           accounts, wallets and human-check records
  privy.ts           server check of a Privy sign-in
  worldid.ts         server side of the World ID check
  survey/            one-time tokens, completion codes, minimum time, the built-in survey
  chain/             three engines behind one interface
    mock.ts          simulation, no blockchain
    vault.ts         budget in a platform-controlled USDC account
    escrow.ts        budget in the escrow program (used by the live demo)
  db/                Postgres: local file database, or Neon when DATABASE_URL is set
program/src/lib.rs   the escrow program (Anchor)
scripts/             setup, check, e2e
tests/               unit tests
```

### The survey round trip

It follows the pattern research panels use with survey tools such as Qualtrics:

1. The participant opens the survey with `?pid=<one-time token>&ref=<submission id>` added.
2. The survey ends by redirecting to `/done?t=<pid>&cc=<completion code>`.
3. The app pays only if the token is unused, the code matches and a minimum time has passed
   (a third of the expected duration by default).

The built-in demo survey plays the role of the survey tool. For your own survey, the study page
shows the exact redirect link to paste into the tool.

## Run it yourself

You need [Node.js](https://nodejs.org) 20.9 or newer.

### 1. Simulation mode (two minutes)

```
npm install
npm run dev
```

Open http://localhost:3000. With no settings, the app runs in **simulation mode**: the whole
flow works, but balances live in a local database and no blockchain is involved.

### 2. Solana devnet

```
npm run setup
```

This creates the platform wallet and writes its key to `.env.local` (never commit that file).
It prints the wallet address. Fund it once:

1. Test SOL for fees: https://faucet.solana.com (choose devnet, paste the address)
2. Test USDC: https://faucet.circle.com (choose USDC and Solana Devnet, paste the address)

Then check that money moves, and run the whole loop without the web pages:

```
npm run check
npm run e2e
```

`npm run e2e` should end with `RESULT: the whole loop works.` Start the app again with
`npm run dev`: every funding and payout now has a "view transaction" link. At this point the
app uses the **vault engine**, where the budget sits in an account controlled by the platform's
key.

### 3. The escrow program

The escrow program replaces that trust with rules on-chain. Build and deploy it from the
browser, with nothing to install:

1. Open https://beta.solpg.io and create a new **Anchor** project.
2. Replace the contents of `src/lib.rs` with `program/src/lib.rs` from this repository.
3. Click the wallet at the bottom left to create a Playground wallet. Give it about 5 test SOL
   (type `solana airdrop 5` in the Playground terminal, or use https://faucet.solana.com).
4. Type `build` in the terminal. Playground fills in the program address in `declare_id!`.
5. Type `deploy`. Copy the **Program Id** it prints.
6. Add it to `.env.local`:

   ```
   ESCROW_PROGRAM_ID=<the program id>
   ```

7. Run `npm run e2e`. The first line should read `Engine: escrow (live on devnet)`, and step 5
   should show the second payout being refused by the program.

To go back to the vault engine, set `CHAIN_ENGINE=vault` in `.env.local`.

### 4. Email sign-in with user-held wallets (Privy)

Without Privy, sign-in is a demo: no email check, and the app holds every wallet. With Privy,
the email is verified by a one-time code and each participant gets a Solana wallet that only
they control.

1. Create an app at https://dashboard.privy.io.
2. Enable **Email** as a login method and **Solana** embedded wallets.
3. Copy the **App ID** and **App Secret** into `.env.local`:

   ```
   PRIVY_APP_ID=<app id>
   PRIVY_APP_SECRET=<app secret>
   ```

4. Restart `npm run dev`. The sign-in pages now show "Sign in with email".

The browser signs in with Privy; the server checks the Privy token, reads the verified email
and wallet address, and starts the app's own session. Once Privy is on, the demo sign-in is
switched off (set `ALLOW_DEMO_SIGNIN=1` to keep it for testing).

### 5. Human check (World ID)

The basic check is one account per email, which does not stop bots. World ID proves that an
account belongs to a unique person, and a study can require it.

1. Create an app in World's Developer Portal (https://developer.world.org). You get three
   values: `app_id`, `rp_id` and a signing key.
2. Add them to `.env.local`:

   ```
   WORLD_APP_ID=app_...
   WORLD_RP_ID=rp_...
   WORLD_SIGNING_KEY=<signing key>
   WORLD_ENVIRONMENT=staging
   ```

3. Restart `npm run dev`. Participant pages now show "Verify with World ID".

With `WORLD_ENVIRONMENT=staging`, nobody needs a real World ID: the code shown by the widget is
scanned or pasted into World's simulator at https://simulator.worldcoin.org. Set it to
`production` to accept real World IDs only.

The app stores the code World returns for a person (the nullifier). It is the same for every
account that person creates here, so a second account with the same World ID is refused.

### 6. Hosting (Vercel and Neon)

1. Create a free Postgres database at https://neon.tech and copy its connection string.
2. Import the repository at https://vercel.com/new.
3. In the project's environment variables, add everything from your `.env.local` plus
   `DATABASE_URL=<Neon connection string>`. Use your own Solana endpoint for `SOLANA_RPC_URL`
   (see Troubleshooting): the public one is rate-limited per internet address.
4. Deploy. Add the hosted address as an allowed origin in the Privy dashboard and in World's
   Developer Portal.

The local file database cannot be used on Vercel; the app refuses to start there without
`DATABASE_URL`.

### Settings

All settings are listed, with a comment each, in [`.env.example`](.env.example). Keys and
secrets belong in `.env.local` or in the host's environment variables, never in the repository.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the app at http://localhost:3000 |
| `npm test` | Unit tests: study rules, survey tokens, transaction building, rate-limit handling |
| `npm run setup` | Creates the platform wallet and `.env.local` |
| `npm run check` | Sends 1 test USDC on devnet as a first live check |
| `npm run e2e` | Runs the whole loop on the engine your settings select |
| `npm run build` | Production build |

## Legal pages

The footer links to `/impressum` and `/privacy`. The name, address and email shown there are in
`lib/legal.ts`. The privacy notice lists outside services (Vercel, Neon, Privy, World ID, the
Solana endpoint) only when they are switched on, so it describes the installation as it runs.
If you change what the app stores or which services it uses, update `app/privacy/page.tsx` and
the date in `lib/legal.ts`.

## Troubleshooting

- `bigint: Failed to load bindings, pure JS will be used` is a harmless notice from a Solana
  library.
- PowerShell refuses to run `npm`: use the Command Prompt instead, or run `npm.cmd`.
- Port 3000 is in use: `npm run dev -- -p 3001`.
- "The Solana endpoint is rate-limiting requests" or `429 Too Many Requests`: the public devnet
  endpoint allows 40 requests of one kind per 10 seconds per internet address. On a shared
  network everybody counts towards the same limit. The app waits and tries again by itself for
  about half a minute. If it keeps happening, use your own endpoint:
  1. Create a free account at https://www.helius.dev and copy the API key.
  2. Set `SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY`.
  3. Run `npm run check` again.

  Treat this address like a password.
- "The network did not confirm the transaction in time": the outcome is unknown. Open the link
  to the transaction on Solana Explorer before trying again, so nothing is paid twice.
- `ERR_REQUIRE_ESM` mentioning `rpc-websockets` and `uuid` on a host: `package.json` pins that
  sub-package to a version that loads everywhere (`overrides`). Run `npm install` and deploy
  again.
- "Sign in with email" stays grey: the Privy app id is wrong, or this address is not an allowed
  origin in the Privy dashboard.
- To start from scratch locally, stop the app and delete the `.data` folder (the local
  database).

## Team

Built by Fabian Fritz, doctoral researcher in entrepreneurship and innovation at WHU – Otto
Beisheim School of Management.
