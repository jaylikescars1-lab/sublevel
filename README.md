# SUBLEVEL

*Build your project car, perfectly.*

A private garage OS for your project car: build roadmap, Next Move, service schedule, money, inventory, hunt list, inspections, DIY guides and a build journal.

This is the phone version. It's a plain static web app with no server and no accounts.

## Where your data lives

On your phone, and nowhere else.

- Garage data is saved in the browser's local storage for this site.
- Photos are saved in IndexedDB on the device.
- A service worker caches the app and fonts, so it opens with no signal.
- Nothing is uploaded. The app makes no network requests besides loading its own files.

Because the only copy is on the phone, export a backup now and then: tap the storage dot in the top bar (or **Backup + restore**), then **Export backup**, and save it to Files or iCloud Drive. **Import a backup** restores it on any device.

## Install on iPhone

1. Open the site in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open SUBLEVEL from the home screen. It runs full screen, like an app.

## Host it (GitHub Pages, free)

1. Push this folder to a GitHub repository.
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The site appears at `https://<your-username>.github.io/<repo-name>/` a minute or two later.

The repo only holds the app code and a sample build. Your own garage is never in the repo.

## Updating

Push changes to `main`. The app picks up the new version the next time it's opened with a connection, and your data is untouched.
