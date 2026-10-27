# SUBLEVEL

*Build your project car, perfectly.*

A private garage OS for your project car: build roadmap, Next Move, service schedule, money, inventory, hunt list, inspections, DIY guides and a build journal.

This is the phone version. It's a plain static web app with no server and no accounts.

## Where your data lives

On your phone, and nowhere else.

- Garage data is saved in the browser's local storage for this site.
- Photos are saved in IndexedDB on the device.
- A service worker caches the app and fonts, so it opens with no signal.
- Nothing is uploaded. Without AI the app makes no network requests besides loading its own files. With AI on, only your AI requests go to Anthropic.
- **Shop parts** buttons open an Amazon or eBay search in your browser. Affiliate IDs, once there are any, live in `js/shop.js`.

The full privacy notice is in [privacy.html](privacy.html).

The phone also keeps up to 10 **earlier versions** of the garage, one from the start of each day and one before every restore, so a mistake can be undone from **Settings → Earlier versions**. They live on the same phone, so they don't replace a backup.

Because the only copy is on the phone, export a backup now and then: **More → Settings → Export backup**, and save it to Files or iCloud Drive. **Import a backup** gives two choices: **Merge it in** adds anything this garage is missing and keeps everything already here (use it to bring over changes made in the claude.ai version), and **Replace everything** restores the file exactly.

## Any car, and AI

Add any car from **My Build → Add car**: type it the way you'd say it ("2004 Lexus IS300 5-speed"), add miles and what it's for, and you're done.

With AI on, Claude researches that exact car and fills in the spec sheet (fluids, plugs, timing, bolt pattern, lug torque, factory wheel), known issues, wheel fitment numbers, a service schedule, and a full 4-phase roadmap with costs, tools and parts. Everything stays editable, and the spec sheet in My Build has every number for people who want them.

AI is optional and turns on in **More → Settings** one of two ways:

- **Access code:** SUBLEVEL's own server (`worker/`, a small Cloudflare Worker) holds the Anthropic key, so people only need a code. They buy one in the app with USDC through Phantom, and it's issued instantly. Setting it up takes about 15 minutes from a phone: see [worker/README.md](worker/README.md). Until it's deployed and `HOSTED_URL` is set in `js/local.js`, this option stays hidden.
- **Your own Anthropic API key:** stored only on your phone, never included in backups, and sent only to Anthropic's API.

Requests are made with the official Anthropic SDK, bundled in `js/vendor/` and loaded only once AI is turned on. Without AI, cars start from a general template.

## Where the numbers come from

- **1996–2000 Civic:** the service schedule (normal and severe), fluids, capacities and torque specs come from Honda's service manual for these cars, cited in the app.
- **Wheel fitment:** tire-width rules from the tire industry standard (ETRTO), calibrated to real owner-reported Civic setups, front and rear. Owners can replace the averages with their own tape measurements (**Fitment → Measure my car**).
- **Any other car:** researched by Claude when AI is on, marked as AI-researched, and editable.

## Simple mode

New people start in **Simple** mode: Garage, Build, Track and More, with no rank, streaks, quick wins or telemetry. **More → Show everything** (or **Settings → View**) turns the full app on. Garages that existed before Simple mode keep showing everything.

## Install on iPhone

1. Open the site in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open SUBLEVEL from the home screen. It runs full screen, like an app.

## Host it (GitHub Pages, free)

1. Push this folder to a GitHub repository.
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The site appears at `https://<your-username>.github.io/<repo-name>/` a minute or two later.

The repo only holds the app code and a sample build. Your own garage is never in the repo.

## Tests

`tests/` checks the fitment math against owner-reported setups and runs the app in a real browser at iPhone size. They run automatically on every push; see [tests/README.md](tests/README.md) to run them yourself.

## Feedback

**More → Send feedback** opens this repo's issue forms (bug or idea).

## Updating

Push changes to `main`. The app picks up the new version the next time it's opened with a connection, and your data is untouched.
