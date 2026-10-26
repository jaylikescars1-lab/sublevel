# SUBLEVEL AI server

A small Cloudflare Worker that lets people use SUBLEVEL's AI with an **access code** instead of their own Anthropic API key. Your key stays on the server as a secret. Nobody ever sees it.

There are two kinds of code:

- **Unlimited codes** you hand out yourself (you, friends, testers).
- **Paid codes** with their own prepaid credit. People buy them in the app: with **USDC on Base** the server checks the payment on the blockchain and gives them a code instantly; with **Cash App** you make their code on your admin page and send it to them.

Everything below works from a phone browser. It takes about 15 minutes.

## Before you start

- **Accounts:** an Anthropic account and a Cloudflare account. Whoever owns them has to be 18 or older.
- **Cost:** Cloudflare's free plan covers this (100,000 requests a day). Anthropic charges per use. A full AI car setup is about 15–30¢; a question or estimate is a few cents. You choose the monthly maximum in step 1.

## 1. Get an Anthropic API key

1. Go to **console.anthropic.com** and sign up.
2. **Billing:** add some credit, like $10.
3. **Limits:** set a monthly spend limit, like $20. This is your safety cap. Anthropic stops all requests once it's reached, so a leaked code can never cost more than this.
4. **API Keys → Create key.** Name it `SUBLEVEL server` and copy it. Don't paste it anywhere except step 3 below.

## 2. Put the server on Cloudflare

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
| `ADMIN_TOKEN` | a long password for your admin page (20+ random characters) |
| `ACCESS_CODES` | optional: unlimited codes you hand out, separated by commas, like `JAY-7Q2K,MIKE-91XD` |

Make unlimited codes hard to guess: a name plus 4 random letters and numbers works.

## 4. Turn it on in the app

Put the worker URL in `js/local.js`:

```js
const HOSTED_URL = "https://sublevel-ai.yourname.workers.dev";
```

(Or send the URL to Claude and it'll do it.) Then in the app: **More → Settings**, type your access code, tap **Turn on**, and it runs a test.

## 5. Sell AI credit (optional)

Add any of these the same way (Settings → Variables and Secrets):

| Name | Value |
| --- | --- |
| `USDC_ADDRESS` | your wallet's address on **Base** (starts with 0x). Turns on instant crypto payments. |
| `CASHTAG` | your Cash App $cashtag, without the $. Turns on Cash App payments. |
| `PRICE_USD` | price of one credit pack. Default `3`. |
| `CREDIT_CENTS` | AI credit in one pack, in cents. Default `200` ($2.00). |

**How a sale works**

- **USDC (automatic):** the buyer sends USDC on the Base network to your address and pastes the transaction ID into the app. The server checks the blockchain: right coin, right network, sent to you, enough money, not used before. Then it gives them a code with credit. Sending 2× the price gets 2 packs. Paying again with their code tops it up.
- **Cash App (by hand):** the buyer pays your $cashtag with their Instagram or email in the note. Open `https://sublevel-ai.yourname.workers.dev/admin` on your phone, enter your admin password and what they paid, tap **Make code**, and send them the code. They enter it under **Have a code?** in Settings. The admin page also lists every code and how much credit it has left.

**How credit is used up**

Each answer is charged from the code's credit by the tokens Claude actually used, at a little above Claude Opus 5.5's list price. Roughly: a full AI car setup is 25–40¢, a question 5–10¢. With the defaults, $3 buys $2.00 of credit, so each sale covers its Anthropic cost with room to spare. When a code runs out, the app tells the person to add more.

**Things to know**

- Anthropic's terms don't allow sharing your API key, which is why buyers get a SUBLEVEL code instead of a key.
- Turning USDC into dollars needs an exchange account (Coinbase, for example), which needs ID and an adult owner.
- Money from sales is income, so keep a record of it for taxes.
- The server uses Base's free public network endpoint. If it ever gets busy, add a `BASE_RPC` variable with an endpoint from a provider like Alchemy or Infura (free tiers work).

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
