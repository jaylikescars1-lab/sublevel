# Tests

Two checks run on every push (see `.github/workflows/test.yml`):

- **`fit.test.cjs`**: the wheel fitment math against real owner-reported Civic setups. It covers the 11 the numbers were tuned on, 6 they weren't, and the rear axle. It also checks the tire-standard rules the engine is built on. Plain Node, no install needed: `node tests/fit.test.cjs`.
- **`app.test.cjs`**: the phone app in a real browser at iPhone size. It covers first run, every page in simple and full mode, fitment, the service schedule, adding a car, logging, and backup export and restore. It also checks the earlier-versions list.

To run both:

```sh
cd tests
npm install
npx playwright install chromium
npm test
```
