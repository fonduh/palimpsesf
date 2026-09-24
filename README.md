# palimpsesf

Version histories of a city, parcel by parcel. [Public site](https://fonduh.github.io/palimpsesf/).

This folder is the published static site. `index.html` and `palimpsest.html` are identical entry points; there is no build step. Keep the external `hero.js` script, parcel-keyed records, archival captions, source credits, fonts, and peel-to-map interaction.

The earlier prototype and design requirements are in `../Documents/free text tool/transamerica-parcel-view/CLAUDE.md` and `DECISIONS.md`. Publish future changes from this repository to avoid overwriting the fixes with an older prototype export.

Parcels, hit testing, and photo stacks use one image list and the same year filter. Local thumbnails must appear in `photo-assets.js`; remote SF Planning images become eligible only after loading successfully. Failed images stop qualifying their parcels immediately. Undated archive images remain eligible across year ranges; Planning's current view is shown only when the range reaches 2026. A landmark's timeline supplements its parcel's archive index.

Photo cards move along a vertical wheel while their images and text remain upright, including stacks with only one or two photos.

Preview with `python3 -m http.server 8877 --bind 127.0.0.1`. Check data with `node scripts/verify-assets.mjs`; after intentionally changing local thumbnails, regenerate their manifest with `node scripts/verify-assets.mjs --write`. With Playwright and Chrome available, run `node tests/browser.cjs` against that preview. `PLAYWRIGHT_PATH` may point to an existing Playwright installation; `TEST_URL` may select another preview URL.

GitHub Pages publishes `main`. Commit and push reviewed runtime changes, then verify the Pages deployment and the live site.
