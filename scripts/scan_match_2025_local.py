#!/usr/bin/env python3
"""
Phase A migracji 2025 — lokalny scan Drive Stream G: + match do excel_2025_matched.

Wejście:
  - Drive Stream root: /g/Dyski współdzielone/21 PROWATECH - INSPEKCJE/04 Inspekcje/2025/
  - scripts/output/excel_2025_matched.json (376 turbin z protocol_number_short)

Wyjście:
  - scripts/output/manifest_2025_full_dryrun.json — pełen raport scan
  - scripts/output/manifest_2025_annual.json — 376 wpisów annual gotowych do upload_batch
  - scripts/output/manifest_2025_full.json — 490 wpisów (annual + 5y dla turbin z has_5y_2025)

Match: po numerze protokołu wyciągniętym z nazwy pliku regexem ^(\\d+)_T_2025.

Filtr non-protocol files (skip):
  - 5letni / 5-letni / 5 letni / Pomiary / Wertykal / Podesty / KOB / FVS /
    uziemien / elektryczn / instrukcja / raport_serwis / GPO

Kopiowanie: tryb --copy. Bez kopiuje tylko skanuje (dryrun).
"""

import json
import re
import sys
import shutil
from pathlib import Path
from datetime import datetime

GDRIVE_2025 = Path(r"G:\Dyski współdzielone\21 PROWATECH - INSPEKCJE\04 Inspekcje\2025")
ROOT = Path(__file__).parent.parent
EXCEL_PATH = ROOT / "scripts/output/excel_2025_matched.json"
PDF_OUT_DIR = ROOT / "scripts/output/pdfs"
DRYRUN_PATH = ROOT / "scripts/output/manifest_2025_full_dryrun.json"
ANNUAL_PATH = ROOT / "scripts/output/manifest_2025_annual.json"
FULL_PATH = ROOT / "scripts/output/manifest_2025_full.json"

# Pliki do pominięcia jako non-protocol
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
    r"\bRobot\b",  # podesty robocze
    r"audyt",
    r"odbi[oó]r",
]
NON_PROTOCOL_RE = re.compile("|".join(NON_PROTOCOL_PATTERNS), re.IGNORECASE)

PROTOCOL_RE_STRICT = re.compile(r"^(\d+)_T_2025", re.IGNORECASE)
PROTOCOL_RE_LOOSE = re.compile(r"(?:^|\s|_)(\d+)_T_2025", re.IGNORECASE)
DATE_RE = re.compile(r"(\d{2})-(\d{2})-(2025)")


def safe_filename(text: str) -> str:
    """Zamień polskie znaki na ASCII, usuń niedozwolone znaki."""
    repl = {
        "ą": "a", "Ą": "A", "ć": "c", "Ć": "C", "ę": "e", "Ę": "E",
        "ł": "l", "Ł": "L", "ń": "n", "Ń": "N", "ó": "o", "Ó": "O",
        "ś": "s", "Ś": "S", "ź": "z", "Ź": "Z", "ż": "z", "Ż": "Z",
    }
    s = "".join(repl.get(ch, ch) for ch in text)
    s = re.sub(r"[\\/:*?\"<>|]", "_", s)
    s = re.sub(r"\s+", "_", s)
    return s


def main():
    do_copy = "--copy" in sys.argv

    # 1. Wczytaj excel
    excel_rows = json.loads(EXCEL_PATH.read_text(encoding="utf-8"))
    print(f"[load] excel_2025_matched.json: {len(excel_rows)} wpisów")
    by_proto = {row["protocol_number_short"]: row for row in excel_rows}

    if not GDRIVE_2025.exists():
        print(f"[FATAL] Brak Drive Stream: {GDRIVE_2025}")
        sys.exit(2)

    # 2. Skan rekurencyjny
    matched = []
    unmatched_no_excel = []
    unmatched_alternative_naming = []
    duplicate_files = {}  # protocol_number -> [files]
    non_protocol_count = 0
    skip_2024_in_2025 = 0

    # rglob może rzucić błędy przez MAX_PATH w POTEGOWO — używamy os.walk z try/except
    import os
    all_pdfs = []
    walk_errors = []
    for dirpath, dirnames, filenames in os.walk(str(GDRIVE_2025)):
        for fn in filenames:
            if fn.lower().endswith(".pdf"):
                all_pdfs.append(Path(dirpath) / fn)
    print(f"[scan] znaleziono {len(all_pdfs)} plików PDF w {GDRIVE_2025}")

    stat_errors = 0
    for pdf in all_pdfs:
        name = pdf.name
        try:
            rel_path = str(pdf.relative_to(GDRIVE_2025))
        except ValueError:
            rel_path = str(pdf)

        # Skip 2024 z subfolderów /2024/
        if "/2024/" in rel_path.replace("\\", "/").lower() or "\\2024\\" in rel_path.lower():
            skip_2024_in_2025 += 1
            continue
        if "2024" in name and "2025" not in name:
            skip_2024_in_2025 += 1
            continue

        # Skip non-protocol (filtr po nazwie PRZED stat() — unika MAX_PATH crash)
        if NON_PROTOCOL_RE.search(name):
            non_protocol_count += 1
            continue

        # Match po regex
        m = PROTOCOL_RE_STRICT.match(name) or PROTOCOL_RE_LOOSE.search(name)

        # stat() może rzucić MAX_PATH error — try/except
        try:
            file_size = pdf.stat().st_size
        except (FileNotFoundError, OSError):
            stat_errors += 1
            file_size = -1

        if not m:
            # Brak match — alternative naming (EDP, etc.)
            if "2025" in name or "Protokol" in name.lower() or "protokol" in name.lower():
                unmatched_alternative_naming.append({
                    "filename": name,
                    "rel_path": rel_path,
                    "size_bytes": file_size,
                })
            else:
                non_protocol_count += 1
            continue

        proto_short = m.group(1)
        excel_row = by_proto.get(proto_short)

        # Wyciągnij datę z nazwy pliku jeśli jest
        dm = DATE_RE.search(name)
        inspection_date_from_filename = None
        if dm:
            day, month, year = dm.groups()
            try:
                inspection_date_from_filename = f"{year}-{month}-{day}"
                # Walidacja
                datetime.strptime(inspection_date_from_filename, "%Y-%m-%d")
            except ValueError:
                inspection_date_from_filename = None

        entry = {
            "protocol_number_short": proto_short,
            "filename": name,
            "rel_path": rel_path,
            "size_bytes": file_size,
            "inspection_date_from_filename": inspection_date_from_filename,
        }

        if not excel_row:
            entry["reason"] = f"protocol_number_short={proto_short} brak w excel_2025_matched"
            unmatched_no_excel.append(entry)
            continue

        # Match found — wzbogać
        entry["protocol_number_full"] = excel_row["protocol_number_full"]
        entry["turbine_id"] = excel_row["turbine_id"]
        entry["turbine_code"] = excel_row["turbine_code"]
        entry["ew_designation"] = excel_row["ew_designation_db"]
        entry["farm_name"] = excel_row["farm_name_db"]
        entry["client_name"] = excel_row["client_name_db"]
        entry["has_5y_2025"] = excel_row["has_5y_2025"]
        entry["inspection_date_2025"] = excel_row["inspection_date_2025"]
        # Preferuj datę z arkusza (autoritative); fallback na datę z filename
        entry["inspection_date_final"] = excel_row.get("inspection_date_2025") or inspection_date_from_filename

        # Duplicate check
        if proto_short in {e["protocol_number_short"] for e in matched}:
            # Już mamy match dla tego numeru — zapisz jako duplikat
            duplicate_files.setdefault(proto_short, []).append(entry)
            continue

        matched.append(entry)

    # Foldery klientów (per top-level dir)
    client_folders = sorted({pdf.relative_to(GDRIVE_2025).parts[0] for pdf in all_pdfs})

    # Missing protocols from excel
    matched_protos = {e["protocol_number_short"] for e in matched}
    missing = [
        {
            "protocol_number_short": proto,
            "protocol_number_full": row["protocol_number_full"],
            "turbine_label": f"{row['turbine_code']} ({row['ew_designation_db']})",
            "farm_name": row["farm_name_db"],
            "client_name": row["client_name_db"],
        }
        for proto, row in by_proto.items() if proto not in matched_protos
    ]

    dryrun = {
        "_comment": "Phase A dryrun (lokalny Drive Stream scan) — protokoły roczne 2025",
        "scan_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "drive_stream_root": str(GDRIVE_2025),
        "total_excel_rows": len(excel_rows),
        "total_pdf_files_scanned": len(all_pdfs),
        "skip_2024_in_2025_count": skip_2024_in_2025,
        "non_protocol_skipped_count": non_protocol_count,
        "matched_count": len(matched),
        "unmatched_no_excel_count": len(unmatched_no_excel),
        "unmatched_alternative_naming_count": len(unmatched_alternative_naming),
        "duplicate_protocols_count": len(duplicate_files),
        "missing_from_excel_count": len(missing),
        "client_folders_count": len(client_folders),
        "client_folders": client_folders,
        "stat_errors_count": stat_errors,
        "matched": matched,
        "unmatched_no_excel": unmatched_no_excel,
        "unmatched_alternative_naming": unmatched_alternative_naming,
        "duplicate_files_for_protocol": duplicate_files,
        "missing_from_excel": missing,
    }

    DRYRUN_PATH.write_text(json.dumps(dryrun, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n[write] {DRYRUN_PATH}")

    print("\n" + "=" * 78)
    print(f"PHASE A WYNIK")
    print("=" * 78)
    print(f"  Foldery klientów (top-level):     {len(client_folders)}")
    print(f"  Plików PDF w GDrive 2025:         {len(all_pdfs)}")
    print(f"  Pominięto (subfolder 2024 / nazwa 2024): {skip_2024_in_2025}")
    print(f"  Pominięto (non-protocol):         {non_protocol_count}")
    print(f"  MATCHED do arkusza:               {len(matched)} / {len(excel_rows)}")
    print(f"  Unmatched (brak w arkuszu):       {len(unmatched_no_excel)}")
    print(f"  Unmatched (alternative naming):   {len(unmatched_alternative_naming)}")
    print(f"  Duplicate files (>1 plik / proto): {len(duplicate_files)}")
    print(f"  Brakujące protokoły z arkusza:    {len(missing)}")

    if missing:
        print("\nBrakujące protokoły z arkusza (TOP 10):")
        for m in missing[:10]:
            print(f"  - {m['protocol_number_full']}: {m['turbine_label']} / {m['farm_name']}")

    if unmatched_alternative_naming:
        print(f"\nUnmatched alternative naming (TOP 10):")
        for e in unmatched_alternative_naming[:10]:
            print(f"  - {e['rel_path']}")

    if duplicate_files:
        print(f"\nDuplicate protocols ({len(duplicate_files)} numerów):")
        for proto, entries in list(duplicate_files.items())[:5]:
            print(f"  - {proto}: {len(entries)+1} plików")

    if not do_copy:
        print(f"\n[hint] uruchom z --copy żeby skopiować {len(matched)} plików do {PDF_OUT_DIR}")
        return

    # 3. Kopiowanie
    PDF_OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n[copy] kopiowanie {len(matched)} plików do {PDF_OUT_DIR}...")
    annual_manifest = []
    full_manifest = []  # 376 annual + 114 five_year
    copy_errors = []
    total_bytes = 0

    for entry in matched:
        src = GDRIVE_2025 / entry["rel_path"]
        # Safe local filename
        local_name = f"P_2025_{entry['protocol_number_short']}_{safe_filename(entry['ew_designation'])}_{entry['turbine_code'].split('-')[0]}.pdf"
        dst = PDF_OUT_DIR / local_name

        try:
            if not dst.exists() or dst.stat().st_size != entry["size_bytes"]:
                shutil.copy2(src, dst)
            total_bytes += entry["size_bytes"]
        except Exception as err:
            copy_errors.append({"src": str(src), "error": str(err)})
            continue

        annual_record = {
            "local_pdf": f"scripts/output/pdfs/{local_name}",
            "source_filename": entry["filename"],
            "gdrive_relative_path": entry["rel_path"],
            "turbine_id": entry["turbine_id"],
            "turbine_label": f"{entry['turbine_code']} ({entry['ew_designation']})",
            "year": 2025,
            "inspection_type": "annual",
            "protocol_number": entry["protocol_number_full"],
            "inspection_date": entry["inspection_date_final"],
            "client_folder": entry["rel_path"].split("\\" if "\\" in entry["rel_path"] else "/")[0],
        }
        annual_manifest.append(annual_record)
        full_manifest.append(annual_record)

        if entry["has_5y_2025"]:
            five_y_record = dict(annual_record)
            five_y_record["inspection_type"] = "five_year"
            full_manifest.append(five_y_record)

    ANNUAL_PATH.write_text(json.dumps(annual_manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    FULL_PATH.write_text(json.dumps(full_manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\n[write] {ANNUAL_PATH}: {len(annual_manifest)} wpisów")
    print(f"[write] {FULL_PATH}: {len(full_manifest)} wpisów (376 annual + 114 five_year)")
    print(f"[copy] łącznie {total_bytes / 1024 / 1024:.1f} MB skopiowane")

    if copy_errors:
        print(f"\n[ERROR] {len(copy_errors)} błędów kopiowania:")
        for e in copy_errors[:5]:
            print(f"  - {e['src']}: {e['error']}")


if __name__ == "__main__":
    main()
