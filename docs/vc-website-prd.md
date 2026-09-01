# PRD: Generative Vision — Website for a Lean Venture Firm

**Status:** Draft v2.0 (trimmed for a firm of <10 people)
**Date:** 2026-09-01
**Reference model:** a16z.com structure, cut down to what a small team can credibly build and sustain

---

## 1. Background

v1 of this PRD generalized a16z.com — the media-company outlier with a full editorial arm. A firm of fewer than ten people copying that skeleton gets empty sections that signal worse than no sections. v2 keeps the structural insights that scale down and cuts everything that requires headcount:

**Kept (the insights that scale):**
- The site is a deal-flow instrument; its job is winning founder attention.
- One shared taxonomy (focus area) tags companies, people, and writing, so every listing page is a filtered query — this is cheap and it's the spine.
- Portfolio as social proof, with the compliance disclaimer treated as structural.
- Thesis-first homepage.

**Cut (requires headcount the firm doesn't have):**
- Programs (accelerators, fellowships, community series)
- Portfolio-wide jobs board
- Podcast production, multi-newsletter operation, books/long-form imprint
- Per-vertical landing pages (collapsed into one Thesis page with sections)
- Heavy CMS + editorial workflow (replaced by flat files / markdown + static site generation)

## 2. Goals

1. Establish thesis and differentiation within 10 seconds — carried by the landing experience (§4.1), not by AUM stats the firm doesn't have.
2. Portfolio browsable and legible as proof, compliant by construction.
3. Publish writing with near-zero operational overhead (markdown in the repo, one newsletter).
4. Whole site maintainable by any partner in an afternoon; no dedicated web staff.

**Non-goals:** LP portal, deal CRM, podcast network, jobs board, per-vertical pages, comment systems.

## 3. Information Architecture

```
Home (interactive landing — the "Generative Vision" journey, §4.1)
├── Portfolio        (single filterable grid)
├── Team             (≤10 people, one page, no detail pages at this size)
├── Thesis           (one page, one section per focus area)
├── Writing          (article index + newsletter signup)
└── Legal            (Disclosures · Terms · Privacy)
```

Global nav: 4 links + wordmark. Footer: sitemap, legal links, newsletter, one email address.

## 4. Component Requirements

### 4.1 Home — the Generative Vision landing experience

The homepage is the differentiation budget. Instead of a stat strip the firm can't match, it is an interactive, scroll-driven journey that literalizes the firm's name and thesis: the same network flows re-projected across the future industries the firm invests in.

**Narrative sequence (five acts, one continuous camera move):**

1. **City** — an isometric, living 3D city at night; glowing flow particles travel the street grid connecting neighborhoods and buildings. Hero wordmark and tagline overlay.
2. **Circuit** — the camera dives into a city block; the street grid is revealed as an integrated-circuit layout. The *same* graph and the *same* flows now run as pulses along copper traces into a central die.
3. **Body** — the camera enters a via and emerges inside an artery; cells stream along the vessel with a heartbeat cadence, branching until the flows become synapses firing across a neural field.
4. **Machine** — the camera pulls back from the synapses: the brain is on an operating table, and a surgical robot's articulated arms are operating on it, its probes carrying the same pulses.
5. **Loop** — the camera pulls out of the operating-room window: the room is one lit window in the city from act 1. Full skyline again; closing thesis copy and pitch CTA.

**Functional requirements:**
- **H-1** Scroll scrubs the journey (URL-stable, ~6 viewport-heights); an autoplay control plays it end-to-end; a progress rail with five labeled stops jumps between acts.
- **H-2** Continuity is literal, not implied: acts 1 and 2 share one node/edge graph and one set of flow routes; the particle system is the single visual motif across all five acts.
- **H-3** Interactive: pointer parallax; click/tap emits a pulse burst in the current act's palette.
- **H-4** Each act carries a copy block mapping it to an investment area (cities & infrastructure → silicon & compute → bio & neurotech → robotics & automation → the loop/thesis + CTA).
- **H-5** At rest (scroll 0) the page is complete: city, wordmark, tagline, nav — nothing hidden behind interaction.
- **H-6** `prefers-reduced-motion`: no autoplay, ambient motion damped, acts still reachable by scroll/rail.
- **H-7** Canvas-rendered, no heavyweight 3D dependency; 60fps target on a mid-range laptop, devicePixelRatio capped; degrades to fewer particles on weak GPUs.
- **H-8** Fully usable on mobile (touch scroll = scrub).

### 4.2 Portfolio
- **P-1** Card grid: logo, name, one-liner, link. Data from one flat file (JSON/YAML) — same schema as PRD v1.
- **P-2** Filters: focus area, status (active/acquired/IPO). Stage and vintage filters deferred until the portfolio is big enough to need them.
- **P-3** Methodology disclaimer adjacent to the grid (inclusion criteria, not an endorsement, past results ≠ future returns). Counsel-reviewed once; template thereafter.

### 4.3 Team
- **T-1** One page, ≤10 entries: photo, name, focus, 2–3 sentence operating-history bio, links. No detail pages, no directory filters — at this size they're overhead.

### 4.4 Thesis
- **V-1** One page, one section per focus area (~200–400 words each), each auto-listing its tagged portfolio companies and writing.
- **V-2** Adding a focus area = one taxonomy term + one copy section.

### 4.5 Writing
- **C-1** Markdown articles in the repo; index with topic/author tags; article pages with byline, date, OpenGraph metadata, RSS.
- **C-2** One newsletter: signup (ESP-hosted form) + archive links. No podcast section unless a show actually exists.
- **C-3** Standing disclaimer block on every post (views ≠ investment advice).

### 4.6 Legal
- **L-1** Disclosures, Terms, Privacy; linked from every footer. Same SEC Marketing Rule obligations as v1 — firm size doesn't shrink these.

## 5. Cross-Cutting

- **Stack:** static site generation from flat files; no CMS, no database. Publishing = merge to main.
- **Taxonomy:** one `focusArea` vocabulary shared by companies, people, posts.
- **Non-functional:** LCP <2.5s (landing canvas paints progressively behind the hero text); WCAG 2.1 AA for all document pages; landing journey is progressive enhancement over a readable text layer; structured data on articles and org.

## 6. Success Metrics

| Metric | Target |
|---|---|
| Landing: reach act 5 (completion of the journey) | ≥25% of visitors |
| Newsletter conversion | ≥2% of uniques |
| Time-to-publish an article | <30 min, any partner |
| Site maintenance | zero dedicated headcount |

## 7. Open Questions

1. Does counsel want a complete investment list page, or does the curated grid + disclaimer suffice at this portfolio size?
2. Does the landing journey ship as the homepage or as `/vision` with a conventional homepage fallback? (Recommend: homepage — it *is* the differentiation.)

---

*Prototype of §4.1 lives at `generative-vision/index.html` in this repo.*
