#!/usr/bin/env python3
"""Phase A migracji 2023 — lokalny scan Drive Stream G: + match po ew_designation.

Strategia (jak Faza 15.G dla 2024):
  - Pobierz placeholdery 2023 z bazy (304 wpisy, 301 pustych)
  - Pobierz wszystkie 425 turbin z ew_designation, turbine_code, client_name, farm_name
  - Skanuj GDrive `04 Inspekcje/2023/` rekurencyjnie
  - Per plik: filtr non-protocol, wyciągnij ew_designation pasujący w nazwie, match per klient
  - Output: manifest_2023_full_dryrun.json + manifest_2023_full.json (gotowy do upload)

Match priorytetowo:
  1. Top-level folder (klient hint) → ograniczenie kandydatów ew_designation do turbin tego klienta
  2. Substring match ew_designation w nazwie pliku (znormalizowane bez spacji/myślników)
  3. Cross-client fallback po serial_number jeśli brak per-klient match

Uruchomienie:
  python scripts/scan_match_2023_local.py            # dryrun
  python scripts/scan_match_2023_local.py --copy     # + kopia plików do scripts/output/pdfs/
"""

import json
import re
import sys
import shutil
import os
from pathlib import Path
from datetime import datetime
from collections import defaultdict

GDRIVE_2023 = Path(r"G:\Dyski współdzielone\21 PROWATECH - INSPEKCJE\04 Inspekcje\2023")
ROOT = Path(__file__).parent.parent
PDF_OUT_DIR = ROOT / "scripts/output/pdfs"
DRYRUN_PATH = ROOT / "scripts/output/manifest_2023_full_dryrun.json"
MANIFEST_PATH = ROOT / "scripts/output/manifest_2023_full.json"

# Filter non-protocol
NON_PROTOCOL_PATTERNS = [
    r"5\s*-?\s*letni",
    r"\bPomiary\b",
    r"\bWertykal\b",
    r"\bPodesty\b",
    r"\bKOB\b",
    r"\bFVS\b",
    r"uziemien",
    r"elektryczn",
    r"instrukcja",
    r"raport_serwis",
    r"\bGPO\b",
    r"\bTKBU\b",
    r"bezpiecznego_u",
    r"bezpiecznego\s+u",
    r"kontroli_BU",
    r"_BU_",
    r"\bRobot\b",
    r"audyt",
    r"odbi[oó]r",
    r"\bkpl\b",  # zbiorcze "kpl." (kompletny pakiet) — nie pojedynczy protokół
    r"kompl[ea]t",
    r"\bgeodet",  # geodeta powykonawczy
    r"zbiornik",  # cytrus zbiorniki, etc.
]
NON_PROTOCOL_RE = re.compile("|".join(NON_PROTOCOL_PATTERNS), re.IGNORECASE)
PROTOCOL_NUM_RE = re.compile(r"^(\d+)_T_2023", re.IGNORECASE)
DATE_RE = re.compile(r"(\d{2})-(\d{2})-(2023)")


def safe_filename(text: str) -> str:
    repl = {
        "ą": "a", "Ą": "A", "ć": "c", "Ć": "C", "ę": "e", "Ę": "E",
        "ł": "l", "Ł": "L", "ń": "n", "Ń": "N", "ó": "o", "Ó": "O",
        "ś": "s", "Ś": "S", "ź": "z", "Ź": "Z", "ż": "z", "Ż": "Z",
    }
    s = "".join(repl.get(ch, ch) for ch in text)
    s = re.sub(r"[\\/:*?\"<>|]", "_", s)
    s = re.sub(r"\s+", "_", s)
    return s


_PL_FOLD = str.maketrans({
    "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n",
    "ó": "o", "ś": "s", "ź": "z", "ż": "z",
    "Ą": "a", "Ć": "c", "Ę": "e", "Ł": "l", "Ń": "n",
    "Ó": "o", "Ś": "s", "Ź": "z", "Ż": "z",
})


def normalize(s: str) -> str:
    """Lowercase, ASCII-fold polskich znaków, remove spaces/dashes/underscores."""
    s = s.lower().translate(_PL_FOLD)
    s = re.sub(r"[\s\-_]+", "", s)
    return s


def load_env():
    env_path = ROOT / ".env.local"
    env = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def fetch_db_data():
    """Pobierz placeholdery 2023 + turbiny z bazy przez supabase-py."""
    from supabase import create_client
    env = load_env()
    sb = create_client("https://lhxhsprqoecepojrxepf.supabase.co", env["SUPABASE_SERVICE_ROLE_KEY"])

    # Placeholdery 2023 (paginacja 1000)
    placeholders = []
    offset = 0
    while True:
        res = (
            sb.table("historical_protocols")
            .select("id, turbine_id, inspection_date, protocol_pdf_url")
            .eq("year", 2023)
            .eq("inspection_type", "annual")
            .range(offset, offset + 999)
            .execute()
        )
        if not res.data:
            break
        placeholders.extend(res.data)
        if len(res.data) < 1000:
            break
        offset += 1000
    print(f"[db] placeholdery 2023: {len(placeholders)} (puste: {sum(1 for p in placeholders if not p['protocol_pdf_url'])})")

    # Wszystkie turbiny + wind_farms + clients
    turbines = []
    offset = 0
    while True:
        res = (
            sb.table("turbines")
            .select("id, turbine_code, ew_designation, serial_number, wind_farms(name, clients(name))")
            .range(offset, offset + 999)
            .execute()
        )
        if not res.data:
            break
        turbines.extend(res.data)
        if len(res.data) < 1000:
            break
        offset += 1000
    print(f"[db] turbiny: {len(turbines)}")

    return placeholders, turbines


def main():
    do_copy = "--copy" in sys.argv

    if not GDRIVE_2023.exists():
        print(f"[FATAL] Brak Drive Stream: {GDRIVE_2023}")
        sys.exit(2)

    placeholders, turbines = fetch_db_data()

    # Mapy
    by_turbine_id = {t["id"]: t for t in turbines}
    placeholder_by_turbine = {p["turbine_id"]: p for p in placeholders}

    # Build map: client_name → [turbines]; oraz client_tokens → distinctive tokens per klient
    by_client = defaultdict(list)
    client_tokens = {}  # client_name (orig) → set distinctive tokens znormalizowanych
    GENERIC_TOKENS = {
        "polska", "energy", "energetyka", "wind", "spzoo", "spk", "spkk", "spkomandytowa",
        "park", "synowie", "spolka", "polka", "park", "sj", "phu", "spolki", "andrzej",
        "kasner", "kamil", "miros", "miroswa", "mirosawa", "wsplnicy", "wspolnicy",
        "nowakowski", "nowakowska", "przedsibiorstwo", "przedsiebiorstwo",
        "handlowousugowe", "handlowo", "uslugowe", "wielobranzowe", "wielobranowe",
        "gmbh", "spka", "spk", "power",  # power dodane bo Jam Power vs Poland Power kolizja
    }
    for t in turbines:
        wf = t.get("wind_farms") or {}
        cl = wf.get("clients") or {}
        client_name = cl.get("name") or "?"
        t["_client_name"] = client_name
        t["_farm_name"] = wf.get("name") or "?"
        by_client[client_name].append(t)

    # Po dodaniu wszystkich turbin: zbuduj distinctive tokens per klient
    # = tokens z client_name UNION tokens z każdej farm_name (lokacja farmy bardziej unique
    # niż słowa generyczne typu "Power")
    for client_name, t_list in by_client.items():
        raw_tokens = list(re.findall(r"[A-Za-zŁĄĆĘŃÓŚŹŻłąćęńóśźż]{5,}", client_name))
        farm_names = {t["_farm_name"] for t in t_list}
        for fn in farm_names:
            raw_tokens.extend(re.findall(r"[A-Za-zŁĄĆĘŃÓŚŹŻłąćęńóśźż]{4,}", fn))
        distinctive = {normalize(tk) for tk in raw_tokens}
        distinctive = {tk for tk in distinctive if tk and tk not in GENERIC_TOKENS}
        client_tokens[client_name] = distinctive

    # Skan plików
    all_pdfs = []
    for dirpath, dirnames, filenames in os.walk(str(GDRIVE_2023)):
        for fn in filenames:
            if fn.lower().endswith(".pdf"):
                all_pdfs.append(Path(dirpath) / fn)
    print(f"[scan] znaleziono {len(all_pdfs)} plików PDF w {GDRIVE_2023}")

    matched = []
    multi_match = []
    no_ew_match = []
    non_protocol = 0
    skip_other_year = 0
    stat_errors = 0
    placeholder_already_filled = []

    for pdf in all_pdfs:
        name = pdf.name
        try:
            rel_path = str(pdf.relative_to(GDRIVE_2023))
        except ValueError:
            rel_path = str(pdf)
        top_folder = rel_path.split(os.sep)[0]

        # Skip non-protocol (filtr nazwy)
        if NON_PROTOCOL_RE.search(name):
            non_protocol += 1
            continue

        # Filtr roku — plik musi zawierać 2023 i NIE zawierać 2024/2025
        name_norm = name.lower()
        if "2023" not in name_norm:
            skip_other_year += 1
            continue
        if "2024" in name_norm or "2025" in name_norm:
            skip_other_year += 1
            continue

        try:
            file_size = pdf.stat().st_size
        except (FileNotFoundError, OSError):
            stat_errors += 1
            continue

        # Klient hint z top-level folder — fuzzy search po słowach kluczowych klienta
        # Zbieramy SCORE per klient (liczba matchujących tokenów), wybieramy MAX
        client_hint = normalize(top_folder)
        candidates = []
        client_strict = False
        client_scores = []
        for client_name, t_list in by_client.items():
            distinctive = client_tokens.get(client_name, set())
            if not distinctive:
                continue
            matching = sum(1 for tok in distinctive if tok in client_hint)
            if matching > 0:
                client_scores.append((matching, client_name, t_list))

        if client_scores:
            # Wybierz klienta z najwyższym score (lub kilku gdy remis)
            max_score = max(s[0] for s in client_scores)
            best = [(s, c, t) for s, c, t in client_scores if s == max_score]
            for _, _, t_list in best:
                candidates.extend(t_list)
            client_strict = True
        else:
            # Fallback: wszystkie turbiny (cross-client)
            candidates = turbines
            client_strict = False

        # Match po ew_designation w nazwie pliku
        name_norm_full = normalize(name)
        ew_matches = []
        for t in candidates:
            ew = t.get("ew_designation")
            if not ew:
                continue
            ew_norm = normalize(ew)
            if not ew_norm or len(ew_norm) < 2:
                continue
            if ew_norm in name_norm_full:
                # Word-boundary-ish: jeśli ostatni znak to cyfra, odrzuć gdy następny też cyfra (WTG1 vs WTG10)
                idx = name_norm_full.find(ew_norm)
                end = idx + len(ew_norm)
                next_ch = name_norm_full[end] if end < len(name_norm_full) else ""
                last_ch = ew_norm[-1]
                if last_ch.isdigit() and next_ch.isdigit():
                    continue
                ew_matches.append(t)

        # Dedup
        seen_ids = set()
        unique_matches = []
        for t in ew_matches:
            if t["id"] not in seen_ids:
                unique_matches.append(t)
                seen_ids.add(t["id"])

        # Wyciągnij liczby z nazwy pliku, wyklucz cyfry w datach (DD-MM-YYYY)
        date_spans = [(m.start(), m.end()) for m in re.finditer(
            r"\d{1,2}[-./]\d{1,2}[-./]\d{2,4}", name)]
        def _in_date(pos):
            return any(s <= pos < e for s, e in date_spans)
        ew_numbers_in_name = set()
        # Cyfry 1-2 znaki otoczone separatorami (np. "EW 2", "Kębłowo 02", "WTG-EW07")
        for m in re.finditer(r"(?:^|[\s_\-/])(\d{1,2})(?=[\s_\-/.]|$)", name):
            if not _in_date(m.start(1)):
                try:
                    ew_numbers_in_name.add(int(m.group(1)))
                except ValueError:
                    pass

        # ── Tie-break: nazwa lokalizacji (po '-' w turbine_code) lub nazwa farmy w nazwie pliku ──
        def location_in_name(t):
            tc = t.get("turbine_code") or ""
            # T009-Wydartowo → "Wydartowo"
            loc = tc.split("-", 1)[1] if "-" in tc else ""
            farm = (t.get("_farm_name") or "").replace("FW ", "").replace("EW ", "")
            score = 0
            if loc:
                loc_norm = normalize(loc)
                if loc_norm and loc_norm in name_norm_full:
                    score += 10
            if farm:
                farm_norm = normalize(farm)
                if farm_norm and len(farm_norm) >= 4 and farm_norm in name_norm_full:
                    score += 5
            # Tie-break po cyfrze w EW: jeśli numbers_in_name zawierają cyfrę z ew_designation
            ew = t.get("ew_designation") or ""
            for ew_num_match in re.finditer(r"(\d+)", ew):
                try:
                    if int(ew_num_match.group(1)) in ew_numbers_in_name:
                        score += 20
                        break
                except ValueError:
                    pass
            return score

        if len(unique_matches) > 1:
            # Pierwszy filtr: tie-break po location/farm score
            scored = sorted(unique_matches, key=lambda t: (-location_in_name(t),
                                                          -len(normalize(t.get("ew_designation") or ""))))
            top_score = location_in_name(scored[0])
            if top_score > 0:
                # Wybierz wszystkie z najwyższym score
                top = [t for t in scored if location_in_name(t) == top_score]
                if len(top) == 1:
                    unique_matches = top
                else:
                    # Po location score wciąż >1 → tie-break po długości EW
                    longest = max(len(normalize(t.get("ew_designation") or "")) for t in top)
                    top = [t for t in top if len(normalize(t.get("ew_designation") or "")) == longest]
                    if len(top) == 1:
                        unique_matches = top
                    else:
                        multi_match.append({
                            "filename": name,
                            "rel_path": rel_path,
                            "candidates": [
                                {"turbine_id": t["id"], "turbine_code": t["turbine_code"],
                                 "ew_designation": t.get("ew_designation"),
                                 "client_name": t["_client_name"], "farm_name": t["_farm_name"]}
                                for t in top
                            ]
                        })
                        continue
            else:
                # Brak location/farm match — zostaje stary tie-break po długości EW
                unique_matches.sort(key=lambda t: len(normalize(t.get("ew_designation") or "")), reverse=True)
                longest = normalize(unique_matches[0].get("ew_designation") or "")
                top = [t for t in unique_matches if normalize(t.get("ew_designation") or "") == longest]
                if len(top) > 1:
                    multi_match.append({
                        "filename": name,
                        "rel_path": rel_path,
                        "candidates": [
                            {"turbine_id": t["id"], "turbine_code": t["turbine_code"],
                             "ew_designation": t.get("ew_designation"),
                             "client_name": t["_client_name"], "farm_name": t["_farm_name"]}
                            for t in top
                        ]
                    })
                    continue
                unique_matches = top

        # Fallback dla "no EW match" — match po lokalizacji + serial_number + singleton-farm
        # WAŻNE: gdy klient jest pewny (strict), NIE pozwalamy cross-client fallback
        if len(unique_matches) == 0 and client_strict and len(candidates) == 1:
            # Singleton-farm auto-match: klient ma dokładnie 1 turbinę → akceptuj match
            # (np. EW Bławaty/Ciółkowo/Łasin gdzie ew_designation=FW Łasin nie matchuje pliku EW Łasin)
            # Sanity check: plik musi być protokołem rocznym 2023
            if PROTOCOL_NUM_RE.match(name) or re.search(r"(?:^|\s|_)(\d+)_T_2023", name):
                unique_matches = list(candidates)

        if len(unique_matches) == 0:
            loc_matches = []
            search_pool = candidates if client_strict else turbines
            for t in search_pool:
                tc = t.get("turbine_code") or ""
                loc = tc.split("-", 1)[1] if "-" in tc else ""
                if loc:
                    loc_norm = normalize(loc)
                    if loc_norm and len(loc_norm) >= 4 and loc_norm in name_norm_full:
                        loc_matches.append(t)
                # Także po serial_number
                sn = t.get("serial_number")
                if sn and len(sn) >= 4 and normalize(sn) in name_norm_full:
                    if t not in loc_matches:
                        loc_matches.append(t)
            # Dedup
            seen_ids = set()
            uniq = []
            for t in loc_matches:
                if t["id"] not in seen_ids:
                    uniq.append(t)
                    seen_ids.add(t["id"])
            if len(uniq) == 1:
                unique_matches = uniq
            elif len(uniq) > 1:
                # Tie-break po cyfrze w EW
                if ew_numbers_in_name:
                    digit_filtered = []
                    for t in uniq:
                        ew = t.get("ew_designation") or ""
                        for ew_num_match in re.finditer(r"(\d+)", ew):
                            try:
                                if int(ew_num_match.group(1)) in ew_numbers_in_name:
                                    digit_filtered.append(t)
                                    break
                            except ValueError:
                                pass
                    if len(digit_filtered) == 1:
                        unique_matches = digit_filtered
                    elif len(digit_filtered) > 1:
                        uniq = digit_filtered  # zaostrz, ale wciąż multi
                if len(unique_matches) == 0:
                    multi_match.append({
                        "filename": name,
                        "rel_path": rel_path,
                        "candidates": [
                            {"turbine_id": t["id"], "turbine_code": t["turbine_code"],
                             "ew_designation": t.get("ew_designation"),
                             "client_name": t["_client_name"], "farm_name": t["_farm_name"]}
                            for t in uniq
                        ],
                        "match_method": "location_fallback",
                    })
                    continue

        if len(unique_matches) == 0:
            # Brak dopasowania
            mp = PROTOCOL_NUM_RE.match(name) or re.search(r"(?:^|\s|_)(\d+)_T_2023", name)
            no_ew_match.append({
                "filename": name,
                "rel_path": rel_path,
                "size_bytes": file_size,
                "top_folder": top_folder,
                "client_hint_match": bool(candidates and candidates is not turbines),
                "protocol_number": mp.group(1) if mp else None,
            })
            continue

        # Single match — zbuduj wpis
        t = unique_matches[0]
        placeholder = placeholder_by_turbine.get(t["id"])

        # Wyciągnij datę z nazwy lub z arkusza (placeholder.inspection_date)
        dm = DATE_RE.search(name)
        inspection_date = None
        if dm:
            day, month, year = dm.groups()
            try:
                inspection_date = f"{year}-{month}-{day}"
                datetime.strptime(inspection_date, "%Y-%m-%d")
            except ValueError:
                inspection_date = None
        if not inspection_date and placeholder:
            inspection_date = placeholder.get("inspection_date")

        # Numer protokołu z nazwy
        mp = PROTOCOL_NUM_RE.match(name) or re.search(r"(?:^|\s|_)(\d+)_T_2023", name)
        proto_short = mp.group(1) if mp else None
        proto_full = f"{proto_short}/T/2023" if proto_short else None

        if placeholder and placeholder.get("protocol_pdf_url"):
            placeholder_already_filled.append({
                "turbine_label": f"{t['turbine_code']} ({t.get('ew_designation')})",
                "filename": name,
            })
            continue

        matched.append({
            "filename": name,
            "rel_path": rel_path,
            "size_bytes": file_size,
            "turbine_id": t["id"],
            "turbine_code": t["turbine_code"],
            "ew_designation": t.get("ew_designation"),
            "client_name": t["_client_name"],
            "farm_name": t["_farm_name"],
            "placeholder_id": placeholder["id"] if placeholder else None,
            "protocol_number": proto_full,
            "inspection_date": inspection_date,
        })

    # Brakujące placeholdery (nie zmatchowane)
    matched_turbine_ids = {m["turbine_id"] for m in matched}
    missing_placeholders = []
    for p in placeholders:
        if p.get("protocol_pdf_url"):
            continue  # już wypełniony
        if p["turbine_id"] in matched_turbine_ids:
            continue  # zostanie wypełniony
        t = by_turbine_id.get(p["turbine_id"])
        if not t:
            continue
        missing_placeholders.append({
            "placeholder_id": p["id"],
            "turbine_id": p["turbine_id"],
            "turbine_code": t["turbine_code"],
            "ew_designation": t.get("ew_designation"),
            "client_name": t["_client_name"],
            "farm_name": t["_farm_name"],
            "inspection_date": p.get("inspection_date"),
        })

    # Output dryrun
    dryrun = {
        "_comment": "Phase A dryrun (lokalny Drive Stream scan) — protokoły roczne 2023",
        "scan_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "drive_stream_root": str(GDRIVE_2023),
        "placeholders_2023_total": len(placeholders),
        "placeholders_2023_empty_before": sum(1 for p in placeholders if not p.get("protocol_pdf_url")),
        "total_pdf_files_scanned": len(all_pdfs),
        "non_protocol_skipped": non_protocol,
        "wrong_year_skipped": skip_other_year,
        "stat_errors": stat_errors,
        "matched_count": len(matched),
        "multi_match_count": len(multi_match),
        "no_ew_match_count": len(no_ew_match),
        "placeholder_already_filled_count": len(placeholder_already_filled),
        "missing_placeholders_count": len(missing_placeholders),
        "matched": matched,
        "multi_match": multi_match,
        "no_ew_match": no_ew_match,
        "placeholder_already_filled": placeholder_already_filled,
        "missing_placeholders": missing_placeholders,
    }
    DRYRUN_PATH.write_text(json.dumps(dryrun, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n[write] {DRYRUN_PATH}")

    print("\n" + "=" * 78)
    print("PHASE A WYNIK 2023")
    print("=" * 78)
    print(f"  Placeholdery 2023 puste:         {dryrun['placeholders_2023_empty_before']}")
    print(f"  Plików PDF w GDrive 2023:        {len(all_pdfs)}")
    print(f"  Pominięte (non-protocol):        {non_protocol}")
    print(f"  Pominięte (wrong year):          {skip_other_year}")
    print(f"  MATCHED:                         {len(matched)}")
    print(f"  Multi-match (ambiguous):         {len(multi_match)}")
    print(f"  No EW match (brak kandydata):    {len(no_ew_match)}")
    print(f"  Już wypełnione placeholdery:     {len(placeholder_already_filled)}")
    print(f"  Brakujące placeholdery 2023:     {len(missing_placeholders)}")

    if missing_placeholders[:8]:
        print("\nBrakujące placeholdery (TOP 8):")
        for m in missing_placeholders[:8]:
            print(f"  - {m['turbine_code']} ({m['ew_designation']}) / {m['farm_name']}")

    if multi_match[:5]:
        print(f"\nMulti-match (TOP 5):")
        for m in multi_match[:5]:
            cands = ", ".join(c['turbine_code'] for c in m['candidates'])
            print(f"  - {m['filename'][:60]} → {cands}")

    if no_ew_match[:5]:
        print(f"\nNo EW match (TOP 5):")
        for e in no_ew_match[:5]:
            print(f"  - {e['filename'][:80]}")

    if not do_copy:
        print(f"\n[hint] uruchom z --copy żeby skopiować {len(matched)} plików do {PDF_OUT_DIR}")
        return

    # Kopia + manifest upload
    PDF_OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n[copy] kopiowanie {len(matched)} plików...")
    manifest = []
    copy_errors = []
    total_bytes = 0
    used_local = {}
    for entry in matched:
        src = GDRIVE_2023 / entry["rel_path"]
        # Unique local_name = bezpieczna wersja source filename, prefix P_2023_
        base = safe_filename(entry["filename"])[:120]
        if not base.lower().endswith(".pdf"):
            base += ".pdf"
        local_name = f"P_2023_{base}"
        # Dedupe (na wypadek gdyby base już istniał)
        if local_name in used_local:
            local_name = f"P_2023_{used_local[local_name]+1}_{base}"
            used_local[local_name] = used_local.get(local_name, 0) + 1
        used_local[local_name] = used_local.get(local_name, 0) + 1
        dst = PDF_OUT_DIR / local_name
        try:
            if not dst.exists() or dst.stat().st_size != entry["size_bytes"]:
                shutil.copy2(src, dst)
            total_bytes += entry["size_bytes"]
        except Exception as err:
            copy_errors.append({"src": str(src), "error": str(err)})
            continue
        manifest.append({
            "local_pdf": f"scripts/output/pdfs/{local_name}",
            "source_filename": entry["filename"],
            "gdrive_relative_path": entry["rel_path"],
            "turbine_id": entry["turbine_id"],
            "turbine_label": f"{entry['turbine_code']} ({entry['ew_designation']})",
            "year": 2023,
            "inspection_type": "annual",
            "protocol_number": entry["protocol_number"] or f"AUTO-{entry['turbine_code']}/2023",
            "inspection_date": entry["inspection_date"],
            "placeholder_id": entry["placeholder_id"],
            "client_folder": entry["rel_path"].split(os.sep)[0],
        })

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[write] {MANIFEST_PATH}: {len(manifest)} wpisów")
    print(f"[copy] łącznie {total_bytes / 1024 / 1024:.1f} MB skopiowane")
    if copy_errors:
        print(f"\n[ERROR] {len(copy_errors)} błędów kopiowania:")
        for e in copy_errors[:5]:
            print(f"  - {e['src']}: {e['error']}")


if __name__ == "__main__":
    main()
