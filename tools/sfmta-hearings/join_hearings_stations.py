#!/usr/bin/env python3
"""Join hearing items to installed stations: find blocked/never-built proposals.

Takes the scraper's bikeshare_items.csv and the establishment dataset
(data/sf_station_established.csv or a fresh one from
build_station_established.py), matches each hearing item to candidate
stations by street-name tokens, and classifies:

  INSTALLED        item's streets match a station; station's first trip is on
                   or after the hearing (lag_months = install lag)
  PRE-EXISTING     matched a station older than the hearing (relocation,
                   rescission, or an expansion of an existing station)
  NOT INSTALLED    no station matches — the interesting rows: proposals that
                   were continued, withdrawn, denied, or quietly dropped

Usage:
  python3 join_hearings_stations.py \
      --items sfmta_hearings_data/bikeshare_items.csv \
      --stations data/sf_station_established.csv \
      --out hearing_station_join.csv
"""
from __future__ import annotations

import argparse
import csv
import re

SUFFIX = {
    "street": "st", "st": "st", "avenue": "ave", "ave": "ave", "av": "ave",
    "boulevard": "blvd", "blvd": "blvd", "drive": "dr", "dr": "dr",
    "highway": "hwy", "hwy": "hwy", "road": "rd", "rd": "rd",
    "lane": "ln", "ln": "ln", "place": "pl", "pl": "pl", "court": "ct",
    "ct": "ct", "terrace": "ter", "ter": "ter", "way": "way",
    "alley": "aly", "aly": "aly", "plaza": "plz", "plz": "plz",
}
_SUFFIX_ALT = "|".join(sorted(set(SUFFIX), key=len, reverse=True))
STREET_RE = re.compile(
    r"\b([A-Za-z0-9.']+(?:\s+[A-Za-z0-9.']+){0,3}?)\s+(" + _SUFFIX_ALT + r")\b",
    re.I,
)
STOPWORDS = {"the", "at", "and", "adjacent", "side", "north", "south", "east",
             "west", "establish", "rescind", "bay", "wheels", "bike", "share",
             "station", "parking", "lot", "lane", "of", "on", "from", "to"}


def street_tokens(text: str) -> set[str]:
    out = set()
    for m in STREET_RE.finditer(text):
        name = re.sub(r"[.']", "", m.group(1)).lower().strip()
        name = " ".join(w for w in name.split() if w not in STOPWORDS)
        if name:
            out.add(f"{name} {SUFFIX[m.group(2).lower()]}")
    return out


def landmark_words(text: str) -> set[str]:
    """Non-street words usable for landmark matching (Glen Park BART, etc.)."""
    words = re.findall(r"[A-Za-z]{3,}", text.lower())
    return {w for w in words if w not in STOPWORDS and w not in SUFFIX}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--items", required=True)
    ap.add_argument("--stations", required=True)
    ap.add_argument("--out", default="hearing_station_join.csv")
    args = ap.parse_args()

    stations = []
    with open(args.stations, newline="") as f:
        for row in csv.DictReader(f):
            if row.get("region", "SF") != "SF":
                continue
            names = row.get("location_names") or row.get("station_name") or ""
            toks = set()
            for nm in names.split(";"):
                toks |= street_tokens(nm.strip())
            stations.append({**row, "_tokens": toks, "_names": names,
                             "_words": landmark_words(names)})

    out_rows = []
    with open(args.items, newline="") as f:
        for item in csv.DictReader(f):
            itoks = street_tokens(item["item_text"])
            iwords = landmark_words(item["item_text"])
            best, best_score = None, 0
            for st in stations:
                # Street-pair matches are strong evidence (weight 2);
                # landmark-word overlap (Glen Park BART, Ferry Building)
                # is the fallback and needs at least 2 shared words.
                street = len(itoks & st["_tokens"])
                lm = len(iwords & st["_words"])
                score = street * 2 + (lm if lm >= 2 else 0)
                if score > best_score:
                    best, best_score = st, score
            hearing_ym = (item["hearing_date"] or "")[:7]
            if best is None or best_score == 0:
                status, lag = "NOT INSTALLED", ""
                match_names, first = "", ""
            else:
                first = best["first_trip_month"]
                match_names = best["_names"]
                if hearing_ym and first >= hearing_ym:
                    status = "INSTALLED"
                    lag = ((int(first[:4]) - int(hearing_ym[:4])) * 12
                           + int(first[5:7]) - int(hearing_ym[5:7]))
                else:
                    status, lag = "PRE-EXISTING", ""
            out_rows.append({
                "hearing_date": item["hearing_date"],
                "decision": item["decision"],
                "status": status,
                "install_lag_months": lag,
                "matched_station": match_names,
                "station_first_trip": first,
                "match_score": best_score,
                "item_text": item["item_text"][:400],
                "source_url": item["url"],
            })

    out_rows.sort(key=lambda r: (r["status"], r["hearing_date"]))
    with open(args.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
        w.writeheader()
        w.writerows(out_rows)
    n_blocked = sum(1 for r in out_rows if r["status"] == "NOT INSTALLED")
    print(f"wrote {args.out}: {len(out_rows)} items, "
          f"{n_blocked} proposed-but-never-installed")


if __name__ == "__main__":
    main()
