# ProofPanel

Pay verified human study participants in USDC on Solana, seconds after they finish.

A researcher locks a study budget. Participants sign in by email, pass a human check, take the
survey and are paid automatically when the survey redirects back. Built for the Superteam Germany
"Build an MVP with Solana at WHU" challenge.

> Status: hackathon prototype. Test network (devnet) and test money only.

## Run it in two minutes (simulation mode)

You need [Node.js](https://nodejs.org) 20.9 or newer. In this folder:

```
npm install
npm run dev
```

Open http://localhost:3000. With no keys set, the app runs in **simulation mode**: everything works,
but balances live in a local database and no blockchain is involved. Use it to learn the flow:

1. Click **Run a study**, sign in with any email, create a study with the built-in demo survey.
2. Click **Get 5 test USDC**, then **Fund study**.
3. Copy the participant link and open it in a private window. Sign in with a different email.
4. Click **Start survey**, answer, submit. You land on the "paid" page.
5. Back in the first window, reload the study page: the completion is listed. Close the study to
   get the unspent budget back.

## Go live on Solana devnet (Friday)

```
npm run setup
```

This creates the platform wallet and writes its key to `.env.local` (never commit that file).
It prints the wallet address. Fund it once:

1. Test SOL for fees: https://faucet.solana.com (choose devnet, paste the address)
2. Test USDC: https://faucet.circle.com (choose USDC and Solana Devnet, paste the address)

Then check that money moves:

```
npm run check
```

It sends 1 test USDC to a new wallet and prints a Solana Explorer link. If that works, run the
whole loop without the web pages:

```
npm run e2e
```

It should end with `RESULT: the whole loop works.` Then start the app again with `npm run dev`.
The banner at the top now says "Solana test network (devnet)", and every funding and payout has a
"view transaction" link.

If something fails, copy the full output and send it to whoever maintains the code.

## Saturday: the escrow program

In the Friday version ("vault" engine), the budget sits in an account controlled by the platform's
key. The escrow program in `program/src/lib.rs` replaces that trust with rules on-chain: a fixed
reward, one payout per wallet, and the remainder only to the researcher.

Build and deploy it from the browser, with nothing to install:

1. Open https://beta.solpg.io and create a new **Anchor** project.
2. Replace the contents of `src/lib.rs` with the file `program/src/lib.rs` from this folder.
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

To go back to the Friday version, set `CHAIN_ENGINE=vault` in `.env.local`.

## Email login with user-held wallets (Privy)

Without Privy, sign-in is a demo: no email check, and the app holds every wallet. With Privy,
the email is verified by a one-time code and each participant gets a Solana wallet that only
they control. Rewards are paid to that wallet.

1. Create an app at https://dashboard.privy.io.
2. In the app's login-method settings, enable **Email**. In the embedded-wallet settings, make
   sure **Solana** wallets are enabled.
3. Copy the **App ID** and **App Secret** (Configuration > App settings > Basics) into `.env.local`:

   ```
   PRIVY_APP_ID=<app id>
   PRIVY_APP_SECRET=<app secret>
   ```

4. Restart `npm run dev`. The sign-in pages now show "Sign in with email".

How it fits together: the browser signs in with Privy, the server checks the Privy token and
reads the verified email and wallet address, then starts the app's own session. Researchers
still fund studies from an app-held "study account"; only participant payouts go to user-held
wallets. Once Privy is on, the demo sign-in is switched off (set `ALLOW_DEMO_SIGNIN=1` to keep
it for testing).

## A real human check (World ID)

The basic check is one account per email, which does not stop bots. World ID proves that an
account belongs to a unique person. A study can require it ("Only accept participants verified
with World ID" in the study form).

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

The app stores the nullifier World returns. It is the same for every account one person creates
here, so a second account with the same World ID is refused.

## Publish (GitHub and Vercel)

The challenge asks for a public GitHub repository. In this folder:

```
git init
git add .
git commit -m "ProofPanel prototype"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.env.local` and `.data` are in `.gitignore` and are not uploaded. Never commit keys.

To put the app online with Vercel:

1. Create a free Postgres database at https://neon.tech and copy its connection string.
2. Import the GitHub repository at https://vercel.com/new.
3. In the project's environment variables, add everything from your `.env.local` plus
   `DATABASE_URL=<Neon connection string>`.
4. Deploy. If you use Privy, add the Vercel address as an allowed origin in the Privy dashboard.

The local file database cannot be used on Vercel; the app refuses to start there without
`DATABASE_URL`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the app at http://localhost:3000 |
| `npm test` | Unit tests: study rules, survey tokens, transaction building |
| `npm run setup` | Creates the platform wallet and `.env.local` |
| `npm run check` | Sends 1 test USDC on devnet as a first live check |
| `npm run e2e` | Runs the whole loop on the engine your settings select |
| `npm run build` | Production build |

## How it is built

```
app/                 pages and API routes (Next.js 16, App Router)
components/          interface pieces
lib/
  studies.ts         the rules: create, fund, start, complete, pay, close
  users.ts           accounts, wallets and human-check records
  privy.ts           server check of a Privy sign-in
  worldid.ts         server side of the World ID check
  survey/token.ts    one-time tokens, completion codes, minimum time
  chain/             three engines behind one interface
    mock.ts          simulation, no blockchain
    vault.ts         Friday version: budget in a platform-controlled USDC account
    escrow.ts        Saturday version: budget in the escrow program
  db/                Postgres: a local file database, or Neon when DATABASE_URL is set
program/src/lib.rs   the escrow program (Anchor)
scripts/             setup, check, e2e
tests/               unit tests
```

### The survey round trip

It follows the pattern research panels use with Qualtrics:

1. The participant opens the survey with `?pid=<one-time token>&ref=<submission id>` added.
2. The survey ends by redirecting to `/done?t=<pid>&cc=<completion code>`.
3. The app pays only if the token is unused, the code matches and a minimum time has passed
   (a third of the expected duration by default).

The built-in demo survey plays the role of the survey tool. For your own survey, the study page
shows the exact redirect link to paste into the tool.

## What is real and what is not yet

| Part | State |
| --- | --- |
| USDC transfers, budget locking, payouts, refunds | Real on devnet in the vault and escrow engines |
| One payout per participant | Database rule in the vault engine; enforced on-chain in the escrow engine |
| Sign-in | Demo by default (no email check, app-held wallets). With Privy: verified email and user-held wallets. |
| Human check | Basic by default (one account per email; does not stop bots). With World ID: one account per person. |
| Researcher funds | Held in an app-controlled "study account" until locked in a study |
| Proof of the human check on-chain | Not built yet (planned with the Solana Attestation Service) |
| Survey answers | Built-in survey: stored, shown on the study page ("Survey results") and included in the CSV export. External survey tool: the tool keeps them; match them to payouts with the `ref` column. |

## Legal pages

The footer links to `/impressum` and `/privacy`. The name, address and email shown there are in
`lib/legal.ts`. The privacy notice lists outside services (Vercel, Neon, Privy, World ID, the Solana
endpoint) only when they are switched on, so it describes the installation as it runs. If you change
what the app stores or which services it uses, update `app/privacy/page.tsx` and the date in
`lib/legal.ts`.

## Troubleshooting

- `bigint: Failed to load bindings, pure JS will be used` is a harmless notice from a Solana
  library. Ignore it.
- PowerShell refuses to run `npm`: use the "Command Prompt" instead, or run `npm.cmd`.
- Port 3000 is in use: `npm run dev -- -p 3001`.
- "The Solana endpoint is rate-limiting requests" or `429 Too Many Requests`: the public devnet
  endpoint allows 40 requests of one kind per 10 seconds **per internet address**. On a shared
  network (a campus, a hackathon room) everybody counts towards the same limit. The app waits and
  tries again by itself for about half a minute, so a short burst only makes things slower. If it
  keeps happening, use your own endpoint, which has its own limit:
  1. Create a free account at https://www.helius.dev and copy the API key from the dashboard.
  2. In `.env.local`, replace the `SOLANA_RPC_URL` line with
     `SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY`
  3. Run `npm run check` again (and restart `npm run dev` if it is running).
  Treat this address like a password: it stays in `.env.local` and is never committed.
- "The network did not confirm the transaction in time": the outcome is unknown. Open the link to
  the transaction on Solana Explorer before trying again, so nothing is paid twice.
- To start from scratch, stop the app and delete the `.data` folder (the local database).
- After pulling a new version of the code, run `npm install` again before `npm run dev`.
- "Sign in with email" stays grey: the Privy app id is wrong, or this address is not an allowed
  origin in the Privy dashboard.
