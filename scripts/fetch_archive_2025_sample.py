#!/usr/bin/env python3
"""
Pobranie 2-3 archiwalnych protokołów rocznych z 2025 r. z R2 pod nazwami zgodnymi
z `src/lib/protocol-filename.ts:buildProtocolFilename`.

Cel: zbudować bazę default_observation per element PIIB na podstawie zapisów
"Opis stanu technicznego" z archiwum.

Wejście:
  - .env.local (R2 + Supabase service_role)
  - Supabase: historical_protocols (year=2025, inspection_type='annual',
    protocol_pdf_r2_key IS NOT NULL) JOIN turbines

Wyjście:
  - scripts/output/archiwum_2025_sample/<ładna_nazwa>.pdf

Uruchomienie:
  python scripts/fetch_archive_2025_sample.py --limit 3
"""

import argparse
import io
import os
import re
import sys
from pathlib import Path

# Wymuszamy UTF-8 na stdout (Windows domyślnie cp1250 — wywala polskie znaki).
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", line_buffering=True)

import boto3
from supabase import create_client

ROOT = Path(__file__).parent.parent
ENV_FILE = Path(r"C:\prowatech-inspekcje\.env.local")
OUT_DIR = ROOT / "scripts/output/archiwum_2025_sample"

SUPABASE_URL = "https://lhxhsprqoecepojrxepf.supabase.co"

R2_ACCOUNT_ID = "587ba2347ed372341fe359b0ed2d632d"
R2_BUCKET = "prowatech-inspekcje"
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com"


def load_env(path: Path) -> dict[str, str]:
    out = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def sanitize_segment(s: str) -> str:
    """Mirror src/lib/protocol-filename.ts:sanitizeSegment."""
    s = re.sub(r'[/\\:*?"<>|]', "_", s)
    s = re.sub(r"[\r\n\t]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def format_date_dmy(iso: str | None) -> str:
    if not iso:
        return ""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", iso)
    if not m:
        return ""
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"


def build_protocol_filename(
    protocol_number: str | None,
    inspection_type: str | None,
    inspection_date: str | None,
    turbine: dict,
    ext: str = "pdf",
) -> str:
    """Mirror src/lib/protocol-filename.ts:buildProtocolFilename."""
    parts: list[str] = []

    proto_no = (protocol_number or "").strip()
    if proto_no:
        parts.append(proto_no.replace("/", "_"))
    else:
        parts.append("Szkic")

    type_label = "5-letniej" if inspection_type == "five_year" else "rocznej"
    parts.append(f"Protokół_kontroli_{type_label}")

    turbine_id = (turbine.get("ew_designation") or "").strip() or (
        turbine.get("turbine_code") or ""
    ).strip()
    if turbine_id:
        parts.append(f"WTG {turbine_id}")

    loc = (turbine.get("location_address") or "").strip()
    if loc and loc.lower() not in turbine_id.lower():
        parts.append(loc)

    date_str = format_date_dmy(inspection_date)
    if date_str:
        parts.append(date_str)

    name = sanitize_segment(" ".join(p for p in parts if p))
    return f"{name}.{ext}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=3, help="liczba PDF-ów do pobrania")
    parser.add_argument("--list-only", action="store_true", help="tylko lista, bez pobierania")
    args = parser.parse_args()

    if not ENV_FILE.exists():
        sys.exit(f"[FATAL] Brak {ENV_FILE}")
    env = load_env(ENV_FILE)

    sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    r2_key = env.get("R2_ACCESS_KEY_ID")
    r2_secret = env.get("R2_SECRET_ACCESS_KEY")
    if not all([sb_key, r2_key, r2_secret]):
        sys.exit("[FATAL] Brak SUPABASE_SERVICE_ROLE_KEY / R2_* w .env.local")

    sb = create_client(SUPABASE_URL, sb_key)

    print(f"[query] historical_protocols year=2025 annual non-null r2_key …")
    res = (
        sb.table("historical_protocols")
        .select(
            "id,year,inspection_type,inspection_date,protocol_number,"
            "protocol_pdf_r2_key,source_filename,"
            "turbine:turbines(id,turbine_code,ew_designation,location_address)"
        )
        .eq("year", 2025)
        .eq("inspection_type", "annual")
        .not_.is_("protocol_pdf_r2_key", "null")
        .order("inspection_date", desc=True)
        .limit(50)
        .execute()
    )
    rows = res.data or []
    print(f"[query] zwrócono {len(rows)} wpisów")

    if not rows:
        sys.exit("[FATAL] Brak protokołów 2025 z PDF w R2")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.list_only:
        for r in rows[: args.limit * 3]:
            t = r.get("turbine") or {}
            fn = build_protocol_filename(
                r.get("protocol_number"),
                r.get("inspection_type"),
                r.get("inspection_date"),
                t,
            )
            print(
                f"  {r['inspection_date']} | {r.get('protocol_number') or '—':>12} | "
                f"{t.get('ew_designation') or t.get('turbine_code') or '?':<24} | "
                f"key={r['protocol_pdf_r2_key']}"
            )
            print(f"      → {fn}")
        return

    s3 = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=r2_key,
        aws_secret_access_key=r2_secret,
        region_name="auto",
    )

    downloaded = 0
    for r in rows:
        if downloaded >= args.limit:
            break
        t = r.get("turbine") or {}
        key = r["protocol_pdf_r2_key"]
        fn = build_protocol_filename(
            r.get("protocol_number"),
            r.get("inspection_type"),
            r.get("inspection_date"),
            t,
        )
        out_path = OUT_DIR / fn
        if out_path.exists():
            print(f"[skip] już istnieje: {fn}")
            downloaded += 1
            continue

        try:
            obj = s3.get_object(Bucket=R2_BUCKET, Key=key)
            data = obj["Body"].read()
            out_path.write_bytes(data)
            size_kb = len(data) / 1024
            print(f"[ok]   {size_kb:>8.1f} KB | {fn}")
            print(f"       source key: {key}")
            print(f"       source filename in DB: {r.get('source_filename')}")
            downloaded += 1
        except Exception as e:
            print(f"[err]  {fn}: {e}")

    print(f"\n[done] pobrane: {downloaded}/{args.limit}, katalog: {OUT_DIR}")


if __name__ == "__main__":
    main()
