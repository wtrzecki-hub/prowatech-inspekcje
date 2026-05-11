"""Wyciąga parametry techniczne turbin z sekcji „Opis techniczny" w protokołach
rocznych 2025 i UPDATE-uje turbines.* w Supabase.

Pola docelowe (9):
  tower_height_m, hub_height_m, rotor_diameter_m,
  tower_segments_count, tower_construction_type,
  foundation_diameter_m, foundation_depth_m,
  building_permit_number, building_permit_date

Skip-rule: jeśli turbina ma JAKIEKOLWIEK z 9 pól non-NULL — skip (nie nadpisujemy).

Źródło: R2 bucket `prowatech-inspekcje`, prefix `historical/<uuid>/2025_annual_*.pdf`.
Strumień przez boto3 → fitz.open(stream=) (bez plików tymczasowych).

Tryby:
  --mode=local <pdf_paths>   — POC, ekstrakcja z lokalnego PDF, wypisuje słownik
  --mode=dryrun [--limit=N]  — pobiera N (lub wszystkie) z R2, ekstraktuje, NIE pisze do DB
  --mode=apply  [--limit=N]  — pobiera, ekstraktuje, UPDATE-uje DB (skip-if-filled)
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path
from typing import Optional, TypedDict


# ─── Config ──────────────────────────────────────────────────────────────────

SUPABASE_URL = "https://lhxhsprqoecepojrxepf.supabase.co"
R2_ENDPOINT = "https://587ba2347ed372341fe359b0ed2d632d.eu.r2.cloudflarestorage.com"
R2_BUCKET = "prowatech-inspekcje"

TARGET_FIELDS = (
    "tower_height_m",
    "hub_height_m",
    "rotor_diameter_m",
    "tower_segments_count",
    "tower_construction_type",
    "foundation_diameter_m",
    "foundation_depth_m",
    "building_permit_number",
    "building_permit_date",
)


class Spec(TypedDict, total=False):
    tower_height_m: float
    hub_height_m: float
    rotor_diameter_m: float
    tower_segments_count: int
    tower_construction_type: str
    foundation_diameter_m: float
    foundation_depth_m: float
    building_permit_number: str
    building_permit_date: str  # ISO YYYY-MM-DD


# ─── env loader ──────────────────────────────────────────────────────────────


def load_env() -> dict[str, str]:
    repo_root = Path(__file__).resolve().parent.parent
    env_path = repo_root / ".env.local"
    env: dict[str, str] = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


# ─── PDF text extraction ─────────────────────────────────────────────────────


def get_opis_techniczny(pdf_bytes: bytes) -> str:
    """Zwraca tekst sekcji „Opis techniczny" (od nagłówka do kolejnej sekcji)."""
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    # Sekcja zwykle na stronach 1-3
    full_text = ""
    for pno in range(min(5, doc.page_count)):
        full_text += doc.load_page(pno).get_text()
    doc.close()

    m = re.search(
        r"Opis techniczny:(.+?)(?:Cz[eę][sś][cć]\s+II|Stan techniczny|Ocena stanu)",
        full_text,
        re.DOTALL | re.IGNORECASE,
    )
    return m.group(1) if m else ""


# ─── Helpers: parsing PL numbers/dates ───────────────────────────────────────


def to_float(s: str) -> Optional[float]:
    s = s.replace(",", ".").replace(" ", "")
    try:
        return float(s)
    except ValueError:
        return None


PL_NUMBER_WORDS = {
    "jeden": 1, "dwa": 2, "trzy": 3, "cztery": 4, "pięć": 5, "piec": 5,
    "sześć": 6, "szesc": 6, "siedem": 7, "osiem": 8, "dziewięć": 9, "dziewiec": 9,
    "dziesięć": 10, "dziesiec": 10,
}


def words_to_int(s: str) -> Optional[int]:
    return PL_NUMBER_WORDS.get(s.strip().lower())


def parse_pl_date(s: str) -> Optional[str]:
    """Zwraca ISO YYYY-MM-DD z formatów: DD.MM.YYYY / DD-MM-YYYY / DD/MM/YYYY."""
    m = re.search(r"(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})", s)
    if not m:
        return None
    try:
        d = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        return d.isoformat()
    except ValueError:
        return None


# ─── Field extractors ────────────────────────────────────────────────────────


_OK_PREFIX = r"(?:ok\.\s*)?"  # opcjonalny „ok." (np. „H= ok. 120 m")


def extract_tower_height(text: str) -> Optional[float]:
    # „Wysokość wieży H=107,05 m" / „H= ok. 120 m" / „wieża o wysokości 107,05 m"
    for pat in (
        r"wysoko[sś][cć]i?\s+wie[zż]y\s*H?\s*=?\s*" + _OK_PREFIX + r"([\d,\. ]+)\s*m",
        r"wie[zż]\w*\s+o\s+wysoko[sś][cć]i\s+" + _OK_PREFIX + r"([\d,\. ]+)\s*m",
    ):
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            v = to_float(m.group(1))
            if v and 30 < v < 200:
                return v
    return None


def extract_hub_height(text: str) -> Optional[float]:
    # „wysokości do osi piasty h = 108,60 m" / „Rotor zawieszony na wysokości 120 m"
    for pat in (
        r"wysoko[sś][cć]i?\s+(?:do\s+osi\s+)?piast\w*\s*h?\s*=?\s*" + _OK_PREFIX + r"([\d,\. ]+)\s*m",
        r"osi\s+piast\w*\s*h?\s*=?\s*" + _OK_PREFIX + r"([\d,\. ]+)\s*m",
        r"rotor\s+zawieszon\w+\s+na\s+wysoko[sś][cć]i\s+" + _OK_PREFIX + r"([\d,\. ]+)\s*m",
        r"hub\s*height\s*[:=]?\s*([\d,\. ]+)",
    ):
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            v = to_float(m.group(1))
            if v and 30 < v < 200:
                return v
    return None


def extract_rotor_diameter(text: str) -> Optional[float]:
    # „Średnica rotora V=120 m" / „Średnica wirnika wynosi 120 m"
    for pat in (
        r"[sś]rednic\w*\s+(?:rotora|wirnika)\s*(?:wynosi)?\s*V?\s*=?\s*" + _OK_PREFIX + r"([\d,\. ]+)\s*m",
        r"rotor\s+diameter\s*[:=]?\s*([\d,\. ]+)",
    ):
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            v = to_float(m.group(1))
            if v and 30 < v < 250:
                return v
    return None


def extract_tower_segments(text: str) -> Optional[int]:
    # „podzieloną na pięć segmentów" / „składa się z 5 segmentów"
    for pat in (
        r"podziel\w*\s+na\s+(\w+|[0-9]+)\s+segment",
        r"sk[lł]ada\s+si[eę]\s+z\s+(\w+|[0-9]+)\s+segment",
        r"(\d+|\w+)\s+segmentów\s+wie[zż]y",
    ):
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            tok = m.group(1)
            if tok.isdigit():
                v = int(tok)
            else:
                v = words_to_int(tok)
            if v and 2 <= v <= 10:
                return v
    return None


def extract_tower_construction_type(text: str) -> Optional[str]:
    # Mapowanie na enum w DB: stalowa / zelbetowa / hybrydowa / inna.
    #
    # PRIORYTET: stalowa > hybrydowa > zelbetowa.
    # Powód: w tekście opisu technicznego „żelbetowa" zwykle odnosi się do fundamentu
    # („konstrukcja fundamentu żelbetowa, monolityczna...") podczas gdy wieża częściej
    # jest stalowa. Jeśli ZARÓWNO „stalowa" jak i „żelbetowa" pojawiają się w opisie
    # wieży, ta pierwsza zwykle dotyczy wieży, druga — fundamentu.
    #
    # Patterns:
    #   1) „wieża X stalową/żelbetową/hybrydową/stalowych segmentów"
    #   2) „wieża X wykonana ze stali"
    #   3) „stalowej wieży" (kolejność odwrócona)
    # Okno 150 znaków — wystarczy by złapać typowe opisy „wieża ... stalową rurą".
    candidates: list[str] = []
    for pat in (
        r"wie[zż]\w*.{0,150}?\b(stalow\w+|[zż]elbetow\w+|hybrydow\w+|betonow\w+)\b",
        r"wie[zż]\w*.{0,150}?wykonan\w+\s+ze?\s+(stali|[zż]elbet\w*|beton\w*)",
        r"\b(stalow\w+|[zż]elbetow\w+|hybrydow\w+|betonow\w+)\s+wie[zż]\w*",
    ):
        for m in re.finditer(pat, text, re.IGNORECASE):
            candidates.append(m.group(1).lower())

    # Priorytet: stalowa > hybrydowa > zelbetowa
    def kind(word: str) -> Optional[str]:
        if word.startswith(("stalow", "stali")):
            return "stalowa"
        if word.startswith("hybrydow"):
            return "hybrydowa"
        if word.startswith(("żelbet", "zelbet", "betonow", "beton")):
            return "zelbetowa"
        return None

    kinds = {kind(c) for c in candidates}
    for prio in ("stalowa", "hybrydowa", "zelbetowa"):
        if prio in kinds:
            return prio
    return None


def extract_foundation_diameter(text: str) -> Optional[float]:
    # Formaty:
    #   „Fundament o kształcie okręgu i średnicy 24,00 m"
    #   „o średnicy przekroju kołowego d=12,10m"
    #   „fundament... średnicy 24,00 m"
    for pat in (
        r"fundament\w*[^.!?]{0,200}?[sś]rednic\w*\s+(?:przekroju\s+ko[lł]owego\s+)?d?\s*=?\s*([\d,\. ]+)\s*m",
        r"[sś]rednic\w*\s+przekroju\s+ko[lł]owego\s+d?\s*=?\s*([\d,\. ]+)\s*m",
    ):
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            v = to_float(m.group(1))
            if v and 5 < v < 50:
                return v
    return None


def extract_foundation_depth(text: str) -> Optional[float]:
    # Formaty:
    #   „Poziom posadowienia fundamentu -2,25 m"
    #   „głębokości posadowienia 2,25 m"
    #   „głębokości 2,25 m p.p.t" (poniżej poziomu terenu)
    for pat in (
        r"posadowieni\w*\s+fundament\w*\s+-?\s*([\d,\. ]+)\s*m",
        r"g[lł][eę]boko[sś][cć]\w*\s+posadowieni\w*\s*[:=]?\s*-?\s*([\d,\. ]+)\s*m",
        r"fundament\w*[^.!?]{0,200}?g[lł][eę]boko[sś][cć]\w*\s+-?\s*([\d,\. ]+)\s*m\s*p\.?\s*p\.?\s*t",
        r"g[lł][eę]boko[sś][cć]\w*\s+-?\s*([\d,\. ]+)\s*m\s*p\.?\s*p\.?\s*t",
    ):
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            v = to_float(m.group(1))
            if v and 0.5 < v < 10:
                return v
    return None


def extract_building_permit(text: str) -> tuple[Optional[str], Optional[str]]:
    # „Data i numer pozwolenia na budowę: 309-3/12/14/16/2020 z dnia 09.03.2020r."
    m = re.search(
        r"pozwoleni\w*\s+na\s+budow[eę]\s*[:.]?\s*([^\n,;]+?)\s+z\s+dnia\s+([\d.\-/]+)",
        text,
        re.IGNORECASE,
    )
    if m:
        num = m.group(1).strip().rstrip(",.;")
        d = parse_pl_date(m.group(2))
        return num, d
    return None, None


# ─── Top-level extract ───────────────────────────────────────────────────────


def extract_spec(pdf_bytes: bytes) -> Spec:
    text = get_opis_techniczny(pdf_bytes)
    if not text:
        return {}

    # Normalizuj whitespace — multi-line fragmenty łatwiej matchować
    text = re.sub(r"\s+", " ", text)

    spec: Spec = {}
    if (v := extract_tower_height(text)) is not None:
        spec["tower_height_m"] = v
    if (v := extract_hub_height(text)) is not None:
        spec["hub_height_m"] = v
    if (v := extract_rotor_diameter(text)) is not None:
        spec["rotor_diameter_m"] = v
    if (v := extract_tower_segments(text)) is not None:
        spec["tower_segments_count"] = v
    if (v := extract_tower_construction_type(text)) is not None:
        spec["tower_construction_type"] = v
    if (v := extract_foundation_diameter(text)) is not None:
        spec["foundation_diameter_m"] = v
    if (v := extract_foundation_depth(text)) is not None:
        spec["foundation_depth_m"] = v
    permit_num, permit_date = extract_building_permit(text)
    if permit_num:
        spec["building_permit_number"] = permit_num
    if permit_date:
        spec["building_permit_date"] = permit_date

    return spec


# ─── R2 + Supabase ───────────────────────────────────────────────────────────


def list_r2_2025_annual(env: dict) -> list[tuple[str, str]]:
    """Zwraca [(turbine_uuid, r2_key), ...] dla wszystkich 2025_annual."""
    import boto3

    s3 = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=env["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    paginator = s3.get_paginator("list_objects_v2")
    out: list[tuple[str, str]] = []
    for page in paginator.paginate(Bucket=R2_BUCKET, Prefix="historical/"):
        for obj in page.get("Contents", []):
            k = obj["Key"]
            m = re.match(r"historical/([0-9a-f-]{36})/2025_annual_", k)
            if m:
                out.append((m.group(1), k))
    out.sort()
    return out


def r2_get_bytes(env: dict, key: str) -> bytes:
    import boto3

    s3 = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=env["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    return s3.get_object(Bucket=R2_BUCKET, Key=key)["Body"].read()


def supa_get(env: dict, path: str) -> list[dict]:
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    req = urllib.request.Request(
        SUPABASE_URL + "/rest/v1/" + path,
        headers={"apikey": key, "Authorization": "Bearer " + key},
    )
    return json.loads(urllib.request.urlopen(req).read())


def supa_patch(env: dict, table: str, id_: str, body: dict) -> None:
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    url = f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{id_}"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="PATCH",
        headers={
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    urllib.request.urlopen(req).read()


def fetch_existing_specs(env: dict, turbine_ids: list[str]) -> dict[str, dict]:
    """Zwraca {turbine_id: {field: value}} dla 9 pól dla podanych turbin."""
    select = ",".join(("id",) + TARGET_FIELDS)
    out: dict[str, dict] = {}
    # PostgREST in.() ma limit ~300 elementów w URL, dzielimy na batch-e
    for i in range(0, len(turbine_ids), 200):
        chunk = turbine_ids[i : i + 200]
        ids_param = urllib.parse.quote(",".join(chunk))
        path = f"turbines?select={select}&id=in.({ids_param})"
        for row in supa_get(env, path):
            out[row["id"]] = row
    return out


def has_any_field_filled(row: dict) -> list[str]:
    """Zwraca listę pól które są non-NULL (decyzja o skip)."""
    return [f for f in TARGET_FIELDS if row.get(f) is not None]


# ─── Modes ───────────────────────────────────────────────────────────────────


def mode_local(paths: list[str]) -> None:
    for p in paths:
        pdf_bytes = Path(p).read_bytes()
        spec = extract_spec(pdf_bytes)
        print(f"\n=== {Path(p).name} ===")
        for f in TARGET_FIELDS:
            v = spec.get(f)
            marker = "✓" if v is not None else "·"
            print(f"  {marker} {f:30s} = {v!r}")
        filled = sum(1 for f in TARGET_FIELDS if spec.get(f) is not None)
        print(f"  → {filled}/9 fields extracted")


def mode_dryrun(limit: Optional[int]) -> None:
    env = load_env()
    keys = list_r2_2025_annual(env)
    print(f"Total 2025_annual on R2: {len(keys)}")
    if limit:
        keys = keys[:limit]
        print(f"Processing first {limit}...")

    existing = fetch_existing_specs(env, [t for t, _ in keys])

    stats = {"processed": 0, "skipped_filled": 0, "extracted_full": 0, "extracted_partial": 0, "no_text": 0}
    samples = []
    for turbine_id, key in keys:
        ex = existing.get(turbine_id)
        if ex is None:
            print(f"  ! turbine not in DB: {turbine_id}")
            continue
        filled_fields = has_any_field_filled(ex)
        if filled_fields:
            stats["skipped_filled"] += 1
            continue
        stats["processed"] += 1
        try:
            pdf_bytes = r2_get_bytes(env, key)
            spec = extract_spec(pdf_bytes)
        except Exception as e:
            print(f"  ! {turbine_id}: {e}")
            continue
        cnt = sum(1 for f in TARGET_FIELDS if spec.get(f) is not None)
        if cnt == 0:
            stats["no_text"] += 1
        elif cnt == 9:
            stats["extracted_full"] += 1
        else:
            stats["extracted_partial"] += 1
        if len(samples) < 5:
            samples.append((turbine_id, key, spec, cnt))

    print("\n=== STATS ===")
    print(f"  processed:       {stats['processed']}")
    print(f"  skipped_filled:  {stats['skipped_filled']}")
    print(f"  extracted_full:  {stats['extracted_full']} (all 9 fields)")
    print(f"  extracted_partial: {stats['extracted_partial']}")
    print(f"  no_text:         {stats['no_text']}")
    print("\n=== SAMPLES ===")
    for turbine_id, key, spec, cnt in samples:
        print(f"\n[{turbine_id}] {key.split('/')[-1]} → {cnt}/9 fields")
        for f in TARGET_FIELDS:
            v = spec.get(f)
            marker = "✓" if v is not None else "·"
            print(f"  {marker} {f:30s} = {v!r}")


def mode_apply(limit: Optional[int]) -> None:
    env = load_env()
    keys = list_r2_2025_annual(env)
    print(f"Total 2025_annual on R2: {len(keys)}")
    if limit:
        keys = keys[:limit]

    existing = fetch_existing_specs(env, [t for t, _ in keys])

    stats = {"updated": 0, "skipped_filled": 0, "no_data": 0, "errors": 0}
    for turbine_id, key in keys:
        ex = existing.get(turbine_id)
        if ex is None:
            continue
        if has_any_field_filled(ex):
            stats["skipped_filled"] += 1
            continue
        try:
            pdf_bytes = r2_get_bytes(env, key)
            spec = extract_spec(pdf_bytes)
        except Exception as e:
            print(f"  ! {turbine_id}: {e}")
            stats["errors"] += 1
            continue
        if not spec:
            stats["no_data"] += 1
            continue
        supa_patch(env, "turbines", turbine_id, dict(spec))
        stats["updated"] += 1
        print(f"  ✓ {turbine_id}: {len(spec)} fields")

    print("\n=== APPLY DONE ===")
    for k, v in stats.items():
        print(f"  {k:20s} {v}")


# ─── CLI ─────────────────────────────────────────────────────────────────────


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--mode", choices=("local", "dryrun", "apply"), required=True)
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("pdfs", nargs="*", help="Local PDF paths for --mode=local")
    args = p.parse_args()

    if args.mode == "local":
        if not args.pdfs:
            print("Usage: --mode=local <pdf1> [pdf2 ...]", file=sys.stderr)
            sys.exit(2)
        mode_local(args.pdfs)
    elif args.mode == "dryrun":
        mode_dryrun(args.limit)
    elif args.mode == "apply":
        mode_apply(args.limit)


if __name__ == "__main__":
    main()
