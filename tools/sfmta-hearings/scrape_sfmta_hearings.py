#!/usr/bin/env python3
"""Scrape SFMTA Engineering Public Hearing agendas & results for bike share items.

Every proposed Bay Wheels station in San Francisco goes through an SFMTA
Engineering Public Hearing (converted parking spaces require one). Agendas and
results are published as pages on sfmta.com, with per-hearing PDF "orders".
This tool discovers those pages, caches them locally, extracts the agenda items
that mention bike share, and records the decision (APPROVED / CONTINUED /
WITHDRAWN / DENIED) where the page states one.

Zero third-party dependencies (stdlib only). If `pypdf` happens to be
installed, linked PDF orders are also text-mined; otherwise their URLs are
recorded for manual follow-up.

Usage:
  python3 scrape_sfmta_hearings.py discover            # find hearing page URLs
  python3 scrape_sfmta_hearings.py fetch               # download + cache pages
  python3 scrape_sfmta_hearings.py extract             # parse -> CSVs
  python3 scrape_sfmta_hearings.py run                 # all three in order
  python3 scrape_sfmta_hearings.py selftest            # parser tests (offline)

Options:
  --workdir DIR      where cache + outputs live (default: ./sfmta_hearings_data)
  --delay SECONDS    politeness delay between requests (default: 1.5)
  --max-pages N      cap on listing-pagination depth (default: 60)
  --since YYYY       ignore hearings before this year (default: 2017)

Outputs (in workdir):
  hearing_pages.csv    every discovered hearing page (url, kind, date)
  bikeshare_items.csv  one row per bike-share agenda/result item
  pdf_orders.csv       linked PDF orders per hearing page

The network layer honors HTTP(S)_PROXY env vars and retries transient
failures. All fetches are cached in workdir/cache/ keyed by URL hash, so
re-runs are incremental and the site is only hit once per page.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import html
import html.parser
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://www.sfmta.com"
LISTING_URLS = [
    # Committee landing page + its paginated past-meetings listing.
    BASE + "/committees/engineering-public-hearings",
]
SITEMAP_URL = BASE + "/sitemap.xml"
USER_AGENT = (
    "sfmta-hearings-scraper/1.0 (civic research; respects robots crawl-delay; "
    "contact: see repository)"
)

# A hearing page URL looks like one of:
#   /notices/engineering-public-hearing-meeting-june-18-2021
#   /notices/engineering-public-hearing-agenda-july-10-2020
#   /reports/engineering-public-hearing-results-march-20-2020
HEARING_URL_RE = re.compile(
    r"/(?:notices|reports)/[a-z0-9-]*engineering-public-hearing[a-z0-9-]*", re.I
)

BIKESHARE_RE = re.compile(r"bike\s*share|bikeshare|bay\s*wheels|gobike", re.I)

DECISION_RE = re.compile(
    r"\b(APPROVED(?:\s+AS\s+AMENDED)?|CONTINUED(?:\s+TO\s+[A-Z0-9 ,]+)?|"
    r"WITHDRAWN|DENIED|NOT\s+APPROVED|REMOVED\s+FROM\s+(?:THE\s+)?AGENDA|"
    r"approved by the City Traffic Engineer)\b",
    re.I,
)

MONTHS = (
    "january february march april may june july august september october "
    "november december".split()
)
DATE_URL_RE = re.compile(
    r"(" + "|".join(MONTHS) + r")-(\d{1,2})-(\d{4})", re.I
)
DATE_TEXT_RE = re.compile(
    r"(" + "|".join(MONTHS) + r")\s+(\d{1,2}),?\s+(\d{4})", re.I
)


# --------------------------------------------------------------------------- #
# HTML -> text/links (stdlib html.parser; no BeautifulSoup dependency)
# --------------------------------------------------------------------------- #
class _PageParser(html.parser.HTMLParser):
    """Collects visible text (block-aware) and all hrefs."""

    BLOCK_TAGS = {
        "p", "div", "li", "tr", "td", "th", "br", "h1", "h2", "h3", "h4",
        "h5", "h6", "section", "article", "ul", "ol", "table",
    }
    SKIP_TAGS = {"script", "style", "noscript", "head", "svg"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.chunks: list[str] = []
        self.links: list[tuple[str, str]] = []  # (href, anchor text)
        self._skip_depth = 0
        self._cur_href: str | None = None
        self._cur_anchor: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in self.SKIP_TAGS:
            self._skip_depth += 1
            return
        if tag in self.BLOCK_TAGS:
            self.chunks.append("\n")
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self._cur_href = href
                self._cur_anchor = []

    def handle_endtag(self, tag: str) -> None:
        if tag in self.SKIP_TAGS:
            self._skip_depth = max(0, self._skip_depth - 1)
            return
        if tag in self.BLOCK_TAGS:
            self.chunks.append("\n")
        if tag == "a" and self._cur_href is not None:
            self.links.append((self._cur_href, " ".join(self._cur_anchor).strip()))
            self._cur_href = None
            self._cur_anchor = []

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        self.chunks.append(data)
        if self._cur_href is not None:
            self._cur_anchor.append(data.strip())


def html_to_text_and_links(markup: str) -> tuple[str, list[tuple[str, str]]]:
    p = _PageParser()
    try:
        p.feed(markup)
    except Exception:
        # Malformed markup: fall back to tag-stripping.
        text = re.sub(r"<[^>]+>", "\n", markup)
        return html.unescape(text), []
    text = "".join(p.chunks)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text, p.links


# --------------------------------------------------------------------------- #
# Fetching with cache
# --------------------------------------------------------------------------- #
def cache_path(workdir: Path, url: str) -> Path:
    h = hashlib.sha256(url.encode()).hexdigest()[:24]
    return workdir / "cache" / f"{h}.body"


def fetch(url: str, workdir: Path, delay: float, binary: bool = False,
          force: bool = False) -> bytes | None:
    cp = cache_path(workdir, url)
    if cp.exists() and not force:
        return cp.read_bytes()
    cp.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_err: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = resp.read()
            cp.write_bytes(body)
            (cp.with_suffix(".url")).write_text(url)
            time.sleep(delay)
            return body
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
            code = getattr(e, "code", None)
            if code in (403, 404, 410):
                # Permanent-ish: record the failure so we don't retry forever.
                (cp.with_suffix(".err")).write_text(f"{code} {url}")
                return None
            last_err = e
            time.sleep(2 ** attempt * 2)
    print(f"  ! giving up on {url}: {last_err}", file=sys.stderr)
    return None


# --------------------------------------------------------------------------- #
# Discovery
# --------------------------------------------------------------------------- #
def discover(workdir: Path, delay: float, max_pages: int) -> list[str]:
    found: set[str] = set()

    # 1. Sitemap(s): most robust — Drupal publishes a sitemap index.
    body = fetch(SITEMAP_URL, workdir, delay)
    sitemap_urls = []
    if body:
        text = body.decode("utf-8", "replace")
        locs = re.findall(r"<loc>\s*([^<]+?)\s*</loc>", text)
        subsitemaps = [u for u in locs if "sitemap" in u and u != SITEMAP_URL]
        page_urls = [u for u in locs if HEARING_URL_RE.search(u)]
        found.update(page_urls)
        sitemap_urls = subsitemaps
    for sm in sitemap_urls:
        body = fetch(sm, workdir, delay)
        if not body:
            continue
        for u in re.findall(r"<loc>\s*([^<]+?)\s*</loc>",
                            body.decode("utf-8", "replace")):
            if HEARING_URL_RE.search(u):
                found.add(u)

    # 2. Committee listing + pagination (?page=N), in case the sitemap is
    #    partial or blocked.
    for base in LISTING_URLS:
        for page in range(max_pages):
            url = base if page == 0 else f"{base}?page={page}"
            body = fetch(url, workdir, delay)
            if not body:
                break
            _, links = html_to_text_and_links(body.decode("utf-8", "replace"))
            new = 0
            for href, _anchor in links:
                if HEARING_URL_RE.search(href):
                    absu = href if href.startswith("http") else BASE + href
                    if absu not in found:
                        found.add(absu)
                        new += 1
            if page > 0 and new == 0:
                break  # ran off the end of the pagination

    urls = sorted(found)
    (workdir / "discovered_urls.json").write_text(json.dumps(urls, indent=1))
    print(f"discovered {len(urls)} hearing page URLs")
    return urls


# --------------------------------------------------------------------------- #
# Parsing
# --------------------------------------------------------------------------- #
def classify(url: str) -> str:
    if "result" in url:
        return "results"
    if "agenda" in url:
        return "agenda"
    return "meeting"


def hearing_date(url: str, text: str) -> str:
    m = DATE_URL_RE.search(url)
    if not m:
        m = DATE_TEXT_RE.search(text[:2000])
    if not m:
        return ""
    month = MONTHS.index(m.group(1).lower()) + 1
    return f"{m.group(3)}-{month:02d}-{int(m.group(2)):02d}"


def split_items(text: str) -> list[str]:
    """Split page text into agenda-item-sized blocks.

    Hearing pages list items either as numbered paragraphs or plain
    paragraphs. We split on blank-ish boundaries and on leading item numbers,
    then merge continuation lines (a decision like "APPROVED" often sits on
    the line after the item body on results pages).
    """
    lines = [ln.strip() for ln in text.split("\n")]
    blocks: list[str] = []
    cur: list[str] = []
    item_start = re.compile(
        r"^(\d{1,3}[.)]\s+|ITEM\s+\d+|[A-Z][.)]\s+|"
        r"(?:ESTABLISH|RESCIND|REVOKE|EXTEND|INSTALL|REMOVE|RELOCATE|"
        r"TEMPORARY|PERMANENT)\b[^a-z]{0,40}[-–—])")
    for ln in lines:
        if not ln:
            if cur:
                blocks.append(" ".join(cur))
                cur = []
            continue
        if item_start.match(ln) and cur:
            blocks.append(" ".join(cur))
            cur = [ln]
        else:
            cur.append(ln)
    if cur:
        blocks.append(" ".join(cur))

    # Attach orphan decision lines ("APPROVED", "CONTINUED ...") to the
    # preceding block.
    merged: list[str] = []
    for b in blocks:
        if merged and len(b) < 80 and DECISION_RE.fullmatch(b.strip(". ")):
            merged[-1] = merged[-1] + " " + b
        else:
            merged.append(b)
    return merged


def extract_decision(block: str) -> str:
    m = DECISION_RE.search(block)
    if not m:
        return ""
    d = m.group(1).upper()
    if "CITY TRAFFIC ENGINEER" in d:
        return "APPROVED"
    if d.startswith("REMOVED"):
        return "WITHDRAWN"
    if d.startswith("NOT APPROVED"):
        return "DENIED"
    return d.split()[0]


def extract_pdf_links(links: list[tuple[str, str]]) -> list[tuple[str, str]]:
    out = []
    for href, anchor in links:
        if re.search(r"/media/\d+/download|\.pdf(\?|$)", href, re.I):
            absu = href if href.startswith("http") else BASE + href
            out.append((absu, anchor))
    return out


def pdf_to_text(body: bytes) -> str:
    try:
        import io

        from pypdf import PdfReader  # optional dependency
    except ImportError:
        return ""
    try:
        reader = PdfReader(io.BytesIO(body))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:
        return ""


def parse_page(url: str, markup: str) -> dict:
    text, links = html_to_text_and_links(markup)
    kind = classify(url)
    date = hearing_date(url, text)
    items = []
    for block in split_items(text):
        if BIKESHARE_RE.search(block):
            items.append({
                "item_text": re.sub(r"\s+", " ", block).strip()[:2000],
                "decision": extract_decision(block) if kind != "agenda" else "",
            })
    return {
        "url": url,
        "kind": kind,
        "hearing_date": date,
        "items": items,
        "pdf_links": extract_pdf_links(links),
    }


# --------------------------------------------------------------------------- #
# Pipeline stages
# --------------------------------------------------------------------------- #
def stage_fetch(workdir: Path, delay: float) -> list[str]:
    urls_file = workdir / "discovered_urls.json"
    if not urls_file.exists():
        sys.exit("run `discover` first (no discovered_urls.json)")
    urls = json.loads(urls_file.read_text())
    ok = 0
    for i, url in enumerate(urls, 1):
        if fetch(url, workdir, delay) is not None:
            ok += 1
        if i % 25 == 0:
            print(f"  fetched {i}/{len(urls)}")
    print(f"fetched/cached {ok}/{len(urls)} hearing pages")
    return urls


def stage_extract(workdir: Path, delay: float, since: int,
                  fetch_pdfs: bool) -> None:
    urls = json.loads((workdir / "discovered_urls.json").read_text())
    pages, item_rows, pdf_rows = [], [], []
    for url in urls:
        body = cache_path(workdir, url)
        if not body.exists():
            continue
        parsed = parse_page(url, body.read_bytes().decode("utf-8", "replace"))
        if parsed["hearing_date"] and int(parsed["hearing_date"][:4]) < since:
            continue
        pages.append(parsed)
        for it in parsed["items"]:
            item_rows.append({
                "hearing_date": parsed["hearing_date"],
                "kind": parsed["kind"],
                "decision": it["decision"],
                "item_text": it["item_text"],
                "url": url,
            })
        for pdf_url, anchor in parsed["pdf_links"]:
            row = {
                "hearing_date": parsed["hearing_date"],
                "page_url": url,
                "pdf_url": pdf_url,
                "anchor": anchor,
                "bikeshare_in_pdf": "",
            }
            if fetch_pdfs:
                body_pdf = fetch(pdf_url, workdir, delay, binary=True)
                if body_pdf:
                    pdftext = pdf_to_text(body_pdf)
                    if pdftext:
                        row["bikeshare_in_pdf"] = str(
                            bool(BIKESHARE_RE.search(pdftext)))
                        for block in split_items(pdftext):
                            if BIKESHARE_RE.search(block):
                                item_rows.append({
                                    "hearing_date": parsed["hearing_date"],
                                    "kind": "pdf-order",
                                    "decision": extract_decision(block),
                                    "item_text": re.sub(
                                        r"\s+", " ", block).strip()[:2000],
                                    "url": pdf_url,
                                })
            pdf_rows.append(row)

    def write(name: str, rows: list[dict], fields: list[str]) -> None:
        with open(workdir / name, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
        print(f"wrote {name}: {len(rows)} rows")

    write("hearing_pages.csv",
          [{"url": p["url"], "kind": p["kind"],
            "hearing_date": p["hearing_date"],
            "n_bikeshare_items": len(p["items"])} for p in pages],
          ["hearing_date", "kind", "n_bikeshare_items", "url"])
    item_rows.sort(key=lambda r: (r["hearing_date"], r["url"]))
    write("bikeshare_items.csv", item_rows,
          ["hearing_date", "kind", "decision", "item_text", "url"])
    write("pdf_orders.csv", pdf_rows,
          ["hearing_date", "page_url", "pdf_url", "anchor", "bikeshare_in_pdf"])


# --------------------------------------------------------------------------- #
# Self-test (offline fixtures)
# --------------------------------------------------------------------------- #
def selftest() -> None:
    fixdir = Path(__file__).parent / "tests" / "fixtures"
    failures = 0

    def check(name: str, cond: bool, detail: str = "") -> None:
        nonlocal failures
        status = "ok" if cond else "FAIL"
        if not cond:
            failures += 1
        print(f"  [{status}] {name}" + (f" — {detail}" if detail and not cond else ""))

    res = parse_page(
        BASE + "/reports/engineering-public-hearing-results-march-20-2020",
        (fixdir / "results_2020_03_20.html").read_text(),
    )
    check("results: date parsed", res["hearing_date"] == "2020-03-20",
          res["hearing_date"])
    check("results: kind", res["kind"] == "results")
    decisions = {it["decision"] for it in res["items"]}
    check("results: found 3 bikeshare items", len(res["items"]) == 3,
          str(len(res["items"])))
    check("results: decisions parsed",
          decisions == {"APPROVED", "CONTINUED", "WITHDRAWN"}, str(decisions))
    check("results: non-bikeshare item excluded",
          not any("speed hump" in it["item_text"].lower()
                  for it in res["items"]))

    ag = parse_page(
        BASE + "/notices/engineering-public-hearing-agenda-july-10-2020",
        (fixdir / "agenda_2020_07_10.html").read_text(),
    )
    check("agenda: date parsed", ag["hearing_date"] == "2020-07-10",
          ag["hearing_date"])
    check("agenda: found 2 bikeshare items", len(ag["items"]) == 2,
          str(len(ag["items"])))
    check("agenda: no decision on agenda items",
          all(it["decision"] == "" for it in ag["items"]))
    check("agenda: pdf order link found",
          any("/media/" in u for u, _ in ag["pdf_links"]),
          str(ag["pdf_links"]))

    check("url regex: meeting variant",
          bool(HEARING_URL_RE.search(
              "/notices/engineering-public-hearing-meeting-june-18-2021")))
    check("url regex: rejects unrelated",
          not HEARING_URL_RE.search("/notices/board-of-directors-meeting"))
    check("decision: continued-to",
          extract_decision("… station. CONTINUED TO APRIL 3, 2020") ==
          "CONTINUED")
    check("decision: traffic engineer phrasing",
          extract_decision(
              "… approved by the City Traffic Engineer for implementation")
          == "APPROVED")

    print(("self-test passed" if failures == 0
           else f"self-test FAILED ({failures})"))
    sys.exit(1 if failures else 0)


# --------------------------------------------------------------------------- #
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("command",
                    choices=["discover", "fetch", "extract", "run", "selftest"])
    ap.add_argument("--workdir", default="sfmta_hearings_data")
    ap.add_argument("--delay", type=float, default=1.5)
    ap.add_argument("--max-pages", type=int, default=60)
    ap.add_argument("--since", type=int, default=2017)
    ap.add_argument("--fetch-pdfs", action="store_true",
                    help="also download PDF orders (and text-mine them if "
                         "pypdf is installed)")
    args = ap.parse_args()

    if args.command == "selftest":
        selftest()
        return

    workdir = Path(args.workdir)
    workdir.mkdir(parents=True, exist_ok=True)
    if args.command in ("discover", "run"):
        discover(workdir, args.delay, args.max_pages)
    if args.command in ("fetch", "run"):
        stage_fetch(workdir, args.delay)
    if args.command in ("extract", "run"):
        stage_extract(workdir, args.delay, args.since, args.fetch_pdfs)


if __name__ == "__main__":
    main()
