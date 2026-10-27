# SUBLEVEL AI server

A small Cloudflare Worker that lets people use SUBLEVEL's AI with an **access code** instead of their own Anthropic API key. Your key stays on the server as a secret. Nobody ever sees it.

There are two kinds of code:

- **Paid codes** with their own prepaid credit. People buy them in the app with **USDC through Phantom**: one tap opens Phantom with the payment filled in, the server finds the payment on the Solana blockchain, and the code is issued instantly. Nobody has to make or send codes by hand.
- **Unlimited codes** you hand out yourself (you, friends, testers), if you want any.

Everything below works from a phone browser. It takes about 15 minutes.

## Before you start

- **Accounts:** an Anthropic account and a Cloudflare account. Whoever owns them has to be 18 or older.
- **Cost:** Cloudflare's free plan covers this (100,000 requests a day). Anthropic charges per use. A full AI car setup is about 20–40¢; a question or estimate is a few cents. You choose the monthly maximum in step 1.

## 1. Get an Anthropic API key

1. Go to **console.anthropic.com** and sign up.
2. **Billing:** add some credit, like $10.
3. **Limits:** set a monthly spend limit, like $20. This is your safety cap. Anthropic stops all requests once it's reached, so a leaked code can never cost more than this.
4. **API Keys → Create key.** Name it `SUBLEVEL server` and copy it. Don't paste it anywhere except step 3 below.

## 2. Put the server on Cloudflare

**Quickest way:** tap this button, sign in to Cloudflare and GitHub, and paste your key from step 1 when it asks for `ANTHROPIC_API_KEY`.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/jaylikescars1-lab/sublevel/tree/main/worker)

The button copies the server into a new repo in your GitHub account and deploys it from there. Changes made to this repo later won't reach it by themselves. If you'd rather it update whenever this repo changes, use the steps below instead.

**Or connect this repo directly:**

1. Go to **dash.cloudflare.com** and sign up (free).
2. **Workers & Pages → Create → Import a repository.** Connect GitHub and pick `jaylikescars1-lab/sublevel`.
3. Name the project **`sublevel-ai`** (it has to match `wrangler.toml`).
4. Set the **root directory** (sometimes labeled "Path") to **`worker`**. Leave the build command empty. The deploy command is `npx wrangler deploy`.
5. Deploy. When it finishes you'll see a URL like `https://sublevel-ai.yourname.workers.dev`. Open it: it should say `{"ok":true,"service":"SUBLEVEL AI"}`.

From then on, Cloudflare redeploys the server by itself whenever the repo changes.

## 3. Add the secrets

In the worker: **Settings → Variables and Secrets → Add**, type **Secret** for each:

| Name | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | the key from step 1 |
| `SOLANA_RPC` | recommended: a Solana network URL from a free provider like Helius (see step 5) |
| `ACCESS_CODES` | optional: unlimited codes you hand out, separated by commas, like `JAY-7Q2K,MIKE-91XD` |

Make unlimited codes hard to guess: a name plus 4 random letters and numbers works.

## 4. Turn it on in the app

Put the worker URL in `js/local.js`:

```js
const HOSTED_URL = "https://sublevel-ai.yourname.workers.dev";
```

(Or send the URL to Claude and it'll do it.) Then in the app: **More → Settings**, type your access code, tap **Turn on**, and it runs a test.

## 5. Selling AI credit with Phantom

This is already switched on: your Phantom wallet's Solana address is in `wrangler.toml` as `SOL_ADDRESS`, so payments go straight to your Phantom wallet.

**How a sale works**

1. In the app, the buyer taps **Get AI credit → Pay 3 USDC in Phantom**.
2. Phantom opens with 3 USDC to your wallet filled in. They approve it and switch back.
3. The app sees the payment on the Solana blockchain within a few seconds and gives them their own code with $2.00 of credit. AI turns on by itself.

If the app gets closed while they're in Phantom, it picks the payment up the next time it opens. If Phantom doesn't open from the link, the buyer can send 3 USDC to your address by hand and paste the transaction signature instead.

The server checks every payment on the blockchain: it has to be real USDC, on Solana, sent to your wallet, at least the price, and never used before. Each payment carries a random reference plus a secret that only the buyer's phone knows, so nobody watching your wallet can claim someone else's payment.

**Settings you can change** (Settings → Variables and Secrets):

| Name | Value |
| --- | --- |
| `PRICE_USD` | price of one credit pack. Default `3`. |
| `CREDIT_CENTS` | AI credit in one pack, in cents. Default `200` ($2.00). |
| `SOLANA_RPC` | Solana's free public endpoint limits how often it can be asked. For reliable checks, sign up for a free account at a provider like Helius, copy your mainnet URL, and paste it here. |

**How credit is used up**

Each answer is charged from the code's credit by the tokens Claude actually used, at a little above Claude Opus 5.5's list price. Roughly: a full AI car setup is 25–50¢, a question 5–10¢. With the defaults, $3 buys $2.00 of credit, so each sale covers its Anthropic cost with room to spare. When a code runs out, the app tells the person to add more.

**Things to know**

- Anthropic's terms don't allow sharing your API key, which is why buyers get a SUBLEVEL code instead of a key.
- USDC lands in your Phantom wallet. Turning it into dollars needs an exchange account (Coinbase, for example), which needs ID and an adult owner.
- Money from sales is income, so keep a record of it for taxes.

**Also built in, switched off:** USDC on Base (`USDC_ADDRESS`), and Cash App with codes you make by hand on the `/admin` page (`CASHTAG` and `ADMIN_TOKEN`). Leave them unset to stay crypto-only.

## Running it

- **Give someone free access:** add a code to `ACCESS_CODES`.
- **Cut off a free code:** remove it from `ACCESS_CODES`.
- **Turn AI off for everyone:** add a secret `PAUSED` with value `1`. Delete it to turn AI back on.
- **Watch spending:** console.anthropic.com → Usage.

## What the server allows

The server rebuilds every request from scratch, so a code can only be used the way the app uses it:

- Claude Opus 5.5 only
- text, plus up to 4 photos per request
- at most 32,000 output tokens per answer, effort low to high
- no tools, no system prompt overrides
- browsers can only call it from the SUBLEVEL web app (and a valid code is required either way)

## Where paid codes live

Paid codes, their credit and the payments that funded them are kept in a small SQLite database inside the worker (a Cloudflare Durable Object, included in the free plan). It's created on the first deploy; there's nothing to set up.
