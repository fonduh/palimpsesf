# PRD: Venture Capital Firm Website

**Status:** Draft v1.0
**Date:** 2026-09-01
**Reference model:** a16z.com (Andreessen Horowitz), generalized for any venture firm

---

## 1. Background & Purpose

A venture firm's website is not a brochure; it is a deal-flow instrument. The firms that treat it that way (a16z being the canonical example) structure the site around a specific insight: **the scarce resource in venture is no longer capital, it's founder attention**, and the website's job is to win that attention before a partner ever takes a meeting.

Analyzing a16z.com yields a repeatable structure. The site serves five distinct audiences with different intents, and every top-level section maps to at least one of them:

| Audience | Intent | Sections that serve them |
|---|---|---|
| Founders (prospective) | "Should I want this firm on my cap table?" | Portfolio, Team, Focus Areas, Content |
| Founders (portfolio) | "What resources do I get?" | Platform/Services, Programs, Jobs board |
| Limited partners | "Is this firm credible and compliant?" | About, Portfolio (exits), Disclosures |
| Press & researchers | "What does this firm think?" | Content hub, About, Team |
| Talent | "Would I work here or at a portfolio company?" | Jobs (firm), Jobs (portfolio network), Programs |

This PRD defines the components, functional requirements, data model, and compliance constraints for a VC website built on that structure.

## 2. Goals & Non-Goals

### Goals
1. Establish the firm's investment thesis and differentiation within 10 seconds of landing.
2. Make the portfolio browsable, filterable, and legible as social proof.
3. Publish thought leadership (articles, podcasts, newsletters) as a first-class product — content is the top of the deal-flow funnel.
4. Present the team as operators/experts, not just check-writers.
5. Meet SEC marketing-rule and disclosure obligations without burying them.

### Non-Goals
- LP portal / fund reporting (separate authenticated product).
- Deal submission pipeline / CRM (link out or embed a form; the pipeline itself is out of scope).
- E-commerce, community forums, event ticketing (v2+ candidates).

## 3. Information Architecture

Generalized sitemap, derived from a16z's top navigation (Portfolio, Team, Focus Areas, Content, Programs, Company):

```
Home
├── Portfolio
│   └── Company detail (optional; may link out)
├── Team
│   └── Person detail
├── Focus Areas (one page per vertical/fund, e.g. AI, Bio, Fintech, Consumer…)
├── Content
│   ├── Articles / Blog
│   ├── Podcasts
│   ├── Newsletters (signup + archive)
│   └── Books / Long-form (optional)
├── Programs (accelerator, scout, talent, community — optional)
├── Company
│   ├── About
│   ├── Jobs (at the firm)
│   ├── Jobs (across portfolio — external board)
│   └── Offices / Contact
└── Legal
    ├── Disclosures
    ├── Terms of Use
    └── Privacy Policy
```

**Navigation requirement:** persistent global header with ≤6 top-level items; verticals and content types nest under dropdowns. Footer repeats full sitemap plus legal links, social links, and newsletter signup.

## 4. Component Requirements

### 4.1 Home

The homepage is thesis-first, not portfolio-first. a16z leads with its founding conviction ("Software is eating the world") before showing anything else.

**Requirements:**
- **H-1** Hero: firm name + one-line thesis/tagline. No carousel.
- **H-2** Credibility strip: AUM, fund count, founding year, notable exits — 3–5 stats max.
- **H-3** Featured content: 3–6 latest/pinned articles or podcast episodes, editorially curated.
- **H-4** Focus-area index: card grid linking to each vertical page.
- **H-5** Portfolio teaser: logo wall of recognizable companies, linking to full portfolio.
- **H-6** Newsletter CTA above the footer.

### 4.2 Portfolio

The single highest-traffic proof page. a16z's implementation: filterable grid of ~800+ companies with per-company metadata, plus a legally mandated methodology disclaimer.

**Requirements:**
- **P-1** Grid of company cards: logo, name, one-line description, link to company site.
- **P-2** Filters (multi-select, URL-persisted so filtered views are shareable):
  - Focus area / sector
  - Stage at first investment (Pre-Seed → Growth)
  - Status (Active / Acquired / IPO)
  - Fund or vintage year (optional)
- **P-3** Free-text search by company name.
- **P-4** Exits surfaced distinctly (badge or dedicated tab) — IPOs and acquisitions are the strongest LP-facing signal.
- **P-5** Compliance disclaimer adjacent to the grid stating the listing methodology: which investments are included/excluded, that the list is not exhaustive, that inclusion is not an endorsement, and that past results don't guarantee future returns. (a16z maintains a separate full "Investment List" page for this reason; provide the same or an equivalent complete list.)
- **P-6** Data-driven: portfolio entries live in structured data (CMS or flat file), not hand-edited markup. Target render <1s for 1,000 entries (virtualize or paginate beyond ~200 visible).

**Company data model:**

```
Company {
  name, logo, url, description (≤140 chars),
  focusAreas[], stageAtEntry, firstInvestmentYear,
  status: active | acquired | ipo,
  fund (optional), featured: bool, coInvestDisclosureFlags[]
}
```

### 4.3 Team

a16z's framing: "investors who've built before, operators who clear the path." The page sells *people as product*.

**Requirements:**
- **T-1** Filterable directory: photo, name, title, focus area.
- **T-2** Group by function: Investing (GPs, partners) vs. Operating/Platform (talent, marketing, GTM, policy, legal) vs. Operations.
- **T-3** Person detail page: bio emphasizing operating history, focus areas, authored content (auto-linked from the content hub), investments led (optional, compliance-reviewed), social links.
- **T-4** CMS-managed; a departure must be removable in minutes, not a deploy cycle.

### 4.4 Focus Areas (Verticals)

a16z gives each practice (AI, Bio + Health, Crypto, Fintech, Enterprise, Consumer, Infrastructure, Growth, American Dynamism…) its own landing page combining thesis + team + portfolio + content. This is the template's key generalizable move: **one page per vertical, assembled from the same underlying data as the rest of the site.**

**Requirements:**
- **V-1** Thesis statement: why the firm invests here, in the firm's own voice (500–1,500 words or a manifesto-style hero).
- **V-2** Auto-populated modules, each filtered to the vertical: team members, portfolio companies, recent content.
- **V-3** Vertical-specific CTA (e.g., the relevant newsletter, or "pitch us").
- **V-4** Adding a vertical requires only a new taxonomy term + thesis copy — no new page engineering.

### 4.5 Content Hub

a16z operates as a media company (podcast network, multiple newsletters, books, an editorial arm). Generalized minimum viable version:

**Requirements:**
- **C-1** Article index with filters by topic/vertical and author; article template with byline linking to team pages, publish date, related content, and share metadata (OpenGraph/Twitter cards).
- **C-2** Podcast section: episode list, embedded player, links out to Spotify/Apple/RSS.
- **C-3** Newsletter: signup (double opt-in, ESP integration) + browsable archive. Per-vertical newsletters optional.
- **C-4** All content tagged with the same taxonomy (vertical, topic, author) that drives Portfolio and Team — one taxonomy, many surfaces.
- **C-5** RSS feeds for articles and each podcast.
- **C-6** Editorial workflow: draft → review → publish, with scheduled publishing.

### 4.6 About

**Requirements:**
- **A-1** Origin story and founding conviction (a16z: founded 2009 on "software eats the world").
- **A-2** How the firm works: stages invested, check sizes (optional), platform/services model.
- **A-3** Key stats (AUM, funds, team size) — same source of truth as homepage stats.
- **A-4** Values / how-we-behave section (optional but differentiating).

### 4.7 Jobs & Programs

- **J-1** Firm jobs: embed or link to ATS (Greenhouse/Lever), as a16z does.
- **J-2** Portfolio jobs board: aggregate roles across portfolio companies (e.g., Getro/Consider integration, as jobs.a16z.com does). This is a founder-facing service, not just recruiting.
- **J-3** Programs pages (accelerator, fellowships, community dinners à la a16z Build): template of description + eligibility + application CTA. Optional module; ship only if the firm runs programs.

### 4.8 Legal & Disclosures

Non-negotiable for a registered investment adviser under the SEC Marketing Rule (Rule 206(4)-1).

**Requirements:**
- **L-1** Disclosures page: portfolio listing methodology, testimonial/endorsement policy, performance-claim policies.
- **L-2** Terms of use, privacy policy, cookie consent (GDPR/CCPA as applicable).
- **L-3** Every page footer links to all three.
- **L-4** Content pages carry a standard "views are the author's own / not investment advice" disclaimer block.
- **L-5** Legal review gate in the publishing workflow for any page naming portfolio companies or performance.

## 5. Cross-Cutting Requirements

### 5.1 Content model (the actual spine of the site)

Five entities and one taxonomy power everything:

- **Company**, **Person**, **Content item** (article/podcast/newsletter issue), **Focus Area** (taxonomy), **Page** (about, disclosures, programs).
- Every entity is taggable by Focus Area; every listing page is a filtered query. This is what lets a16z present the same data as a portfolio grid, a vertical page, and a person's "investments" list without triple-entry.

### 5.2 Non-functional

- **N-1 Performance:** LCP <2.5s on 4G; portfolio page interactive <3s with full dataset.
- **N-2 SEO:** SSR/SSG for all public pages; structured data (Organization, Person, Article, PodcastEpisode); clean shareable URLs for filtered views.
- **N-3 Accessibility:** WCAG 2.1 AA; logo walls need alt text; filters keyboard-navigable.
- **N-4 Analytics:** page views, newsletter conversions, portfolio-filter usage, content engagement; UTM-clean.
- **N-5 CMS:** non-engineers publish content, edit team/portfolio entries, and reorder homepage features without deploys.
- **N-6 Responsive:** full parity on mobile; founders read VC content on phones.

## 6. Success Metrics

| Metric | Target (first 6 months) |
|---|---|
| Newsletter signup conversion (site-wide) | ≥2% of unique visitors |
| Content: avg. engaged time on articles | ≥2 min |
| Portfolio page: filter interaction rate | ≥30% of page visitors |
| Inbound qualified deal flow attributable to site/content | Baseline established, then +20% QoQ |
| Time-to-publish for a new article | <1 hour, no engineer involved |
| Team page update latency (join/departure) | Same day |

## 7. Phasing

- **v1 (launch):** Home, Portfolio (with filters + disclaimer), Team, About, Articles, Newsletter signup, Legal pages.
- **v1.1:** Focus Area pages, Podcasts, portfolio jobs board.
- **v2:** Programs, multi-newsletter, books/long-form, person↔content↔company auto-crosslinking, search across the whole site.

## 8. Open Questions

1. Does the firm's counsel require a complete investment list (à la a16z's separate Investment List page), or does a curated portfolio with methodology disclaimer suffice?
2. Are check sizes / stage focus public, or intentionally vague?
3. Podcast: original production or embed-only?
4. Should exited companies remain on the main grid (badge) or move to a separate exits view?

---

*Sources for structural analysis: a16z.com homepage, /portfolio/, /team/, /about/, vertical pages (/growth/, /enterprise/, /fintech/, /consumer/), /investment-list/, jobs.a16z.com, build.a16z.com.*
