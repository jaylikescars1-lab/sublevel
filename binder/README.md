# Project Car Binder: printables that sell themselves on Etsy

A separate side business, nothing to do with the SUBLEVEL app: printable PDF logbooks for car people, sold as instant downloads on Etsy.

Once the listings are up, every sale happens without you. Etsy shows the listings in search all day, takes the payment, delivers the PDFs to the buyer, and pays the money into the bank account on file. There's no stock, no shipping and no server, and keeping all four listings up costs about $1.

## What's for sale

| Listing | Pages | Suggested price |
| --- | --- | --- |
| Project Car Binder | 16 | $6.99 |
| Car Maintenance Log | 6 | $3.99 |
| Used Car Inspection Checklist | 2 | $2.49 |
| Track Day Kit | 2 | $2.99 |

Every listing comes in US Letter and A4, so buyers anywhere can print it.

## Setup (one time, about 45 minutes, works from a phone)

1. **Open an Etsy shop** at etsy.com/sell. The shop and its payout bank account have to be in an adult's name; if you're under 18, a parent or guardian opens it. Etsy asks for ID and a bank account, and may charge a small one-time fee to open the shop.
2. **Make the 4 listings.** For each one, open [listings.md](listings.md) and copy the title, description, tags and price. Upload its 4 photos from `listing/<name>/` in order, then its 2 PDFs. Choose **Digital files**.
3. **Optional, but it helps:** make a free Pinterest business account and post the 4 pins in `listing/pins/`, each linking to its Etsy listing. Pins keep sending people to a listing for months.

That's it. Nothing else has to run.

## What to expect

Honestly: new Etsy shops often sell nothing for the first few weeks, while Etsy figures out who to show the listings to. After that, a realistic hope for four listings is a handful of sales a month, and some shops make less. Nobody can promise sales, but the downside is tiny: about $1 to keep the listings up, and no money spent on stock.

Etsy takes a share of each sale: a 20¢ listing fee, a transaction fee and payment processing. Roughly, a $6.99 sale leaves you about $5.80, and a $2.49 sale about $1.80. Etsy's fee page has the current numbers. Sales are income, so keep a record for taxes.

**More sales later:**

- **More listings.** Each listing is another way to be found. The same source can make a truck & off-road version, a motorcycle version, an EV version or a gift edition in minutes. Ask Claude.
- **Reviews.** The first few reviews matter most. Answer every message quickly.
- **Car communities.** Share the free tips from the pages (the "real price" idea, the inspection list) where self-promotion is allowed, with a link.

## Files

| Path | What it is |
| --- | --- |
| `src/pages.html` | Every page, and which pages go in which product |
| `build.cjs` | Makes the PDFs, listing photos and pins |
| `listings.md` | Titles, descriptions, tags and prices to paste into Etsy |
| `listing/` | Listing photos (4 per product) and Pinterest pins |
| `dist/` | The PDFs buyers download. Made by the build, not saved in git |
| `fonts/` | Barlow, under the SIL Open Font License, so it's fine to use in PDFs you sell |

**Why the PDFs aren't in git:** this repo can be public and served by GitHub Pages, and the PDFs are what people pay for. Keep them out of the repo so nobody can download them for free.

## Rebuild after a change

```
node binder/build.cjs
```

This needs Node and Playwright with Chromium. The build stops with an error if anything spills off a page.
