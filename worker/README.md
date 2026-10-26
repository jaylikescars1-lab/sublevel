# SUBLEVEL AI server

A small Cloudflare Worker that lets people use SUBLEVEL's AI with an **access code** instead of their own Anthropic API key. Your key stays on the server as a secret, and only people with a code you gave them can use it.

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
| `ACCESS_CODES` | the codes you'll hand out, separated by commas, like `JAY-7Q2K,MIKE-91XD` |

Make codes hard to guess: a name plus 4 random letters and numbers works.

## 4. Turn it on in the app

Put the worker URL in `js/local.js`:

```js
const HOSTED_URL = "https://sublevel-ai.yourname.workers.dev";
```

(Or send the URL to Claude and it'll do it.) Then in the app: **More → Settings**, type your access code, tap **Turn on**, and it runs a test.

## Running it

- **Give someone access:** add a code to `ACCESS_CODES`.
- **Cut someone off:** remove their code.
- **Turn AI off for everyone:** add a secret `PAUSED` with value `1`. Delete it to turn AI back on.
- **Watch spending:** console.anthropic.com → Usage.

## What the server allows

The server rebuilds every request from scratch, so a code can only be used the way the app uses it:

- Claude Opus 5.5 only
- text, plus up to 4 photos per request
- at most 32,000 output tokens per answer, effort low to high
- no tools, no system prompt overrides
- browsers can only call it from the SUBLEVEL web app (and a valid code is required either way)

## Selling access later

Right now access is a list of codes you hand out. To sell it, swap that list for license keys from a payment service like Lemon Squeezy. The check is in one place near the top of `src/index.js`.
