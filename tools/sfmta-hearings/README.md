# SFMTA bikeshare hearing scraper

Tools for reconstructing the paper trail of Bay Wheels (Lyft) station siting
in San Francisco. Every station in the public right-of-way goes through an
SFMTA Engineering Public Hearing; agendas and results are published on
sfmta.com but there is no machine-readable dataset. These scripts build one,
and join it against station installation dates derived from Lyft's public
trip data — so you can see which proposals were approved, continued,
withdrawn, or quietly never built, and how long approval-to-install took.

All three scripts are Python 3.9+ stdlib-only. `pypdf` is optional (enables
text-mining the per-hearing PDF orders).

## 1. Scrape hearings

```
python3 scrape_sfmta_hearings.py run --workdir sfmta_hearings_data
```

Stages (also runnable separately as `discover` / `fetch` / `extract`):

1. **discover** — finds hearing page URLs from sfmta.com's sitemap plus the
   Engineering Public Hearings committee listing and its pagination.
   URLs look like `/notices/engineering-public-hearing-meeting-june-18-2021`
   or `/reports/engineering-public-hearing-results-march-20-2020`.
2. **fetch** — downloads each page into `workdir/cache/` (idempotent; pages
   are fetched once, with a politeness delay, default 1.5s).
3. **extract** — parses cached pages into:
   - `hearing_pages.csv` — every hearing page with date and item count
   - `bikeshare_items.csv` — one row per agenda/result item mentioning
     bike share / Bay Wheels / GoBike, with the stated decision
     (APPROVED / CONTINUED / WITHDRAWN / DENIED) on results pages
   - `pdf_orders.csv` — linked PDF hearing orders (add `--fetch-pdfs` to
     download them; with `pypdf` installed they are text-mined too)

Offline parser tests: `python3 scrape_sfmta_hearings.py selftest`.

## 2. Build station establishment dates

```
python3 build_station_established.py --out station_established.csv
```

Streams all monthly trip files from Lyft's public bucket
(`baywheels-data.s3.amazonaws.com`, ~1GB, June 2017 onward) and derives each
station location's first and last trip month. First-trip month tracks
installation within days-to-weeks. Renames are collapsed when within ~100m.
Resumable; state checkpoints to `station_data/station_months.json`.

A prebuilt snapshot (through July 2026) is committed at
`data/station_established.csv`.

## 3. Join: find blocked / never-built proposals

```
python3 join_hearings_stations.py \
    --items sfmta_hearings_data/bikeshare_items.csv \
    --stations data/station_established.csv \
    --out hearing_station_join.csv
```

Matches hearing items to stations by cross-street tokens (weight 2 each)
with a landmark-word fallback ("Glen Park BART"), and classifies each item:

- `INSTALLED` — a matching station's first trip is on/after the hearing;
  `install_lag_months` measures approval-to-service time
- `PRE-EXISTING` — matched a station older than the hearing (relocations,
  rescissions, expansions)
- `NOT INSTALLED` — no matching station ever appeared in the trip data:
  the blocked/dropped proposals

`match_score` ≤ 2 means a single street or landmark matched — verify those
rows by hand before drawing conclusions.

## Caveats

- The trip bucket starts June 2017 (Ford GoBike relaunch); the 2013–2016
  pilot era is not covered.
- Hearing pages before ~2017 are sparse on sfmta.com; some outcomes exist
  only inside the PDF orders (use `--fetch-pdfs`).
- Item text is parsed heuristically from Drupal page markup; page redesigns
  may need `split_items()` adjustments. The self-test fixtures encode the
  known formats.
- sfmta.com blocks some cloud egress; run the scraper from a residential
  or office network if fetches 403.
