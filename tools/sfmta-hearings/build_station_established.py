#!/usr/bin/env python3
"""Build per-station establishment dates from Bay Wheels public trip data.

Streams every monthly trip file from Lyft's public S3 bucket
(https://baywheels-data.s3.amazonaws.com, ~1GB total, June 2017 onward) and
records, for every station name ever seen: first trip month, last trip month,
and coordinates. First-trip month is a reliable proxy for the station's
installation date (usually within days). The 2013–2016 Bay Area Bike Share
pilot era is not in this bucket.

Stdlib only. Resumable: state is checkpointed to station_months.json after
every file, so an interrupted run picks up where it left off.

Usage:
  python3 build_station_established.py [--workdir DIR] [--out CSV]

Output CSV columns:
  location_names   station names seen at this location (renames collapsed
                   when within ~100m of each other), oldest first
  first_trip_month YYYY-MM of the first recorded trip
  last_trip_month  YYYY-MM of the most recent recorded trip
  lat, lon
  still_active     True if trips within the final 3 months of the data
  region           SF / East Bay / San Jose (by coordinates)
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import subprocess
import zipfile
from collections import defaultdict
from pathlib import Path

BUCKET = "https://baywheels-data.s3.amazonaws.com"

# (name column, lat column, lon column) across the schema generations.
COLUMN_SETS = [
    ("start_station_name", "start_lat", "start_lng"),
    ("start_station_name", "start_station_latitude", "start_station_longitude"),
    ("end_station_name", "end_lat", "end_lng"),
    ("end_station_name", "end_station_latitude", "end_station_longitude"),
]


def curl(url: str, out: Path | None = None) -> bytes:
    cmd = ["curl", "-sS", "--fail", "-m", "600", url]
    if out:
        cmd += ["-o", str(out)]
        subprocess.run(cmd, check=True)
        return b""
    return subprocess.run(cmd, check=True, capture_output=True).stdout


def list_bucket() -> list[str]:
    xml = curl(f"{BUCKET}/?list-type=2&max-keys=1000").decode()
    return [k for k in re.findall(r"<Key>([^<]+)</Key>", xml)
            if k.endswith(".zip")]


def month_of(key: str) -> str:
    m = re.match(r"(\d{4})(\d{2})?", key)
    return f"{m.group(1)}-{m.group(2)}" if m.group(2) else m.group(1)


def process(workdir: Path) -> dict:
    state_path = workdir / "station_months.json"
    state = (json.loads(state_path.read_text())
             if state_path.exists() else {"done": [], "stations": {}})
    keys = list_bucket()
    zpath = workdir / "cur.zip"
    for key in keys:
        if key in state["done"]:
            continue
        curl(f"{BUCKET}/{key}", zpath)
        mon = month_of(key)
        try:
            z = zipfile.ZipFile(zpath)
        except zipfile.BadZipFile:
            print(f"  ! bad zip: {key}")
            state["done"].append(key)
            continue
        for name in z.namelist():
            if not name.endswith(".csv") or name.startswith("__MACOSX"):
                continue
            with z.open(name) as f:
                reader = csv.DictReader(
                    io.TextIOWrapper(f, encoding="utf-8-sig", errors="replace"))
                cols = reader.fieldnames or []
                active = [cs for cs in COLUMN_SETS if cs[0] in cols]
                for row in reader:
                    for ncol, latcol, loncol in active:
                        sname = row.get(ncol) or ""
                        if not sname:
                            continue
                        st = state["stations"].get(sname)
                        if st is None:
                            st = state["stations"][sname] = {
                                "first": mon, "last": mon,
                                "lat": None, "lon": None}
                        else:
                            if mon < st["first"]:
                                st["first"] = mon
                            if mon > st["last"]:
                                st["last"] = mon
                        if st["lat"] in (None, ""):
                            la, lo = row.get(latcol), row.get(loncol)
                            if la and lo:
                                st["lat"], st["lon"] = la, lo
        zpath.unlink(missing_ok=True)
        state["done"].append(key)
        state_path.write_text(json.dumps(state))
        print(f"done {key} ({len(state['stations'])} stations)")
    return state


def region_of(lat: float, lon: float) -> str:
    if lat < 37.60:
        return "San Jose"
    if lon > -122.35:
        return "East Bay"
    return "SF"


def write_csv(state: dict, out: Path) -> None:
    months = sorted({v["last"] for v in state["stations"].values()})
    recent = months[-3:] if len(months) >= 3 else months

    located = {}
    skipped = 0
    for name, v in state["stations"].items():
        try:
            lat, lon = float(v["lat"]), float(v["lon"])
        except (TypeError, ValueError):
            skipped += 1
            continue
        located[name] = {**v, "lat": lat, "lon": lon}

    # Collapse renames: same location to ~3 decimal places (~100m).
    by_loc = defaultdict(list)
    for name, v in located.items():
        by_loc[(round(v["lat"], 3), round(v["lon"], 3))].append(name)

    rows = []
    for (lat, lon), names in by_loc.items():
        names.sort(key=lambda n: located[n]["first"])
        first = min(located[n]["first"] for n in names)
        last = max(located[n]["last"] for n in names)
        rows.append({
            "location_names": "; ".join(names),
            "first_trip_month": first,
            "last_trip_month": last,
            "lat": lat,
            "lon": lon,
            "still_active": last >= recent[0],
            "region": region_of(lat, lon),
        })
    rows.sort(key=lambda r: (r["region"], r["first_trip_month"]))
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {out}: {len(rows)} locations "
          f"({skipped} station names lacked coordinates and were skipped)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--workdir", default="station_data")
    ap.add_argument("--out", default="station_established.csv")
    args = ap.parse_args()
    workdir = Path(args.workdir)
    workdir.mkdir(parents=True, exist_ok=True)
    state = process(workdir)
    write_csv(state, Path(args.out))


if __name__ == "__main__":
    main()
