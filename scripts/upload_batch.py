#!/usr/bin/env python3
"""
Batch upload archiwum protokołów PIIB: lokalne PDF → Cloudflare R2 → UPDATE placeholder w bazie.

Wykorzystuje manifest JSON wygenerowany przez Claude (z mapą plik → turbine_id, year, type).
Iteruje przez wszystkie pozycje, dla każdej:
  1. PUT na R2 pod kluczem `historical/{turbine_id}/{year}_{type}_{ts}_{rand}.pdf`
  2. UPDATE placeholder w `historical_protocols` (ustawia r2_key, url, file_size, source_filename, protocol_number)
  3. SKIP jeśli placeholder już ma `protocol_pdf_url` (był wcześniej wgrany)

Format manifestu (JSON array):
[
  {
    "local_pdf": "scripts/output/pdfs/95_T_2024_EW_1_Kowalewo.pdf",
    "source_filename": "95_T_2024 Protokol_kontroli_rocznej EW 1 Kowalewo 30-08-2024.pdf",
    "gdrive_file_id": "1ljM8X_n_FZn4WYtTuN92A3Jh9hVqqJHh",
    "turbine_id": "fc7f18d6-cb55-45b8-a13b-1c44dbe406c7",
    "turbine_label": "T150-Kowalewo Opactwo (EW 1)",
    "year": 2024,
    "inspection_type": "annual",
    "protocol_number": "95/T/2024",
    "inspection_date": "2024-08-30",
    "placeholder_id": "ef5741d0-...",
    "client_folder": "GÓLCZ I SYNOWIE Sp. z o.o. _ FW Kowalewo, Strzałkowo"
  },
  ...
]

Uruchomienie:
  cd C:\\prowatech-inspekcje
  python scripts/upload_batch.py scripts/output/manifest_golcz_2024.json

Po sukcesie:
  - Pliki PDF na R2 pod prawidłowymi kluczami
  - Placeholdery w `historical_protocols` zaktualizowane
  - Raport JSON zapisany w scripts/output/report_<ts>.json
  - Linki do weryfikacji wypisane w outputcie
"""

import os
import sys
import json
import time
import random
import string
from pathlib import Path
from datetime import datetime
from urllib.parse import quote


R2_ACCOUNT_ID = "587ba2347ed372341fe359b0ed2d632d"
R2_BUCKET = "prowatech-inspekcje"
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com"
R2_PUBLIC_URL = "https://pub-edbf124678454e819a88cd7054401694.r2.dev"
SUPABASE_URL = "https://lhxhsprqoecepojrxepf.supabase.co"
APP_URL = "https://prowatech-inspekcje.vercel.app"


def load_env_local() -> dict:
    env_path = Path(__file__).parent.parent / ".env.local"
    if not env_path.exists():
        print(f"[FATAL] Brak .env.local: {env_path}")
        sys.exit(2)
    env = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def encode_r2_path(key: str) -> str:
    return "/".join(quote(seg, safe="") for seg in key.split("/"))


def build_r2_key(turbine_id: str, year: int, itype: str, ext: str = "pdf") -> str:
    ts = int(time.time() * 1000)
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"historical/{turbine_id}/{year}_{itype}_{ts}_{rand}.{ext}"


def main():
    if len(sys.argv) < 2:
        print(f"Użycie: python {sys.argv[0]} <manifest.json>")
        sys.exit(2)

    manifest_path = Path(sys.argv[1])
    if not manifest_path.exists():
        print(f"[FATAL] Brak manifestu: {manifest_path}")
        sys.exit(2)

    items = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(items, list) or not items:
        print(f"[FATAL] Manifest pusty lub nieprawidłowy")
        sys.exit(2)

    print("=" * 78)
    print(f"Batch upload archiwum: {len(items)} pozycji")
    print(f"Manifest: {manifest_path}")
    print("=" * 78)

    env = load_env_local()
    for k in ("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "SUPABASE_SERVICE_ROLE_KEY"):
        if k not in env:
            print(f"[FATAL] Brak {k} w .env.local")
            sys.exit(2)

    try:
        import boto3
    except ImportError:
        print("[FATAL] pip install boto3")
        sys.exit(2)
    try:
        from supabase import create_client
    except ImportError:
        print("[FATAL] pip install supabase")
        sys.exit(2)

    s3 = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=env["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    sb = create_client(SUPABASE_URL, env["SUPABASE_SERVICE_ROLE_KEY"])

    report = {
        "started_at": datetime.now().isoformat(),
        "manifest": str(manifest_path),
        "uploaded": [],
        "skipped_already_uploaded": [],
        "errors": [],
        "by_turbine": {},
    }

    for idx, item in enumerate(items, 1):
        prefix = f"[{idx}/{len(items)}]"
        label = item.get("turbine_label", item["turbine_id"])
        local_pdf = Path(__file__).parent.parent / item["local_pdf"]
        has_pid = bool(item.get("placeholder_id"))

        try:
            # Walidacja pliku
            if not local_pdf.exists():
                raise FileNotFoundError(f"Brak pliku lokalnego: {local_pdf}")
            file_size = local_pdf.stat().st_size

            # Sprawdź czy rekord już ma plik (idempotentność)
            if has_pid:
                # Tryb UPDATE-by-id: lookup po placeholder_id (existing 2024 flow)
                existing = (
                    sb.table("historical_protocols")
                    .select("id, protocol_pdf_url, source_filename")
                    .eq("id", item["placeholder_id"])
                    .single()
                    .execute()
                )
                existing_row = existing.data
            else:
                # Tryb UPSERT-by-key: lookup po (turbine_id, year, inspection_type)
                existing = (
                    sb.table("historical_protocols")
                    .select("id, protocol_pdf_url, source_filename")
                    .eq("turbine_id", item["turbine_id"])
                    .eq("year", item["year"])
                    .eq("inspection_type", item["inspection_type"])
                    .limit(1)
                    .execute()
                )
                existing_row = existing.data[0] if existing.data else None

            if existing_row and existing_row.get("protocol_pdf_url"):
                print(
                    f"{prefix} SKIP {label}: już wgrany ({existing_row.get('source_filename')})"
                )
                report["skipped_already_uploaded"].append(
                    {
                        "placeholder_id": item.get("placeholder_id") or existing_row.get("id"),
                        "turbine_label": label,
                        "existing_url": existing_row["protocol_pdf_url"],
                    }
                )
                continue

            # Upload na R2
            r2_key = build_r2_key(item["turbine_id"], item["year"], item["inspection_type"])
            print(f"{prefix} {item['protocol_number']}: {local_pdf.name} ({file_size:,} B) -> {label}")
            with open(local_pdf, "rb") as f:
                s3.put_object(
                    Bucket=R2_BUCKET,
                    Key=r2_key,
                    Body=f,
                    ContentType="application/pdf",
                )
            public_url = f"{R2_PUBLIC_URL}/{encode_r2_path(r2_key)}"

            # HEAD verify
            head = s3.head_object(Bucket=R2_BUCKET, Key=r2_key)
            if head["ContentLength"] != file_size:
                raise RuntimeError(
                    f"R2 size mismatch: {head['ContentLength']} != {file_size}"
                )

            # UPDATE placeholder lub INSERT/UPDATE-by-key
            note = (
                f"Auto-import (Faza 15.G/15.H batch, {datetime.now().strftime('%Y-%m-%d')}). "
                f"Folder klienta: {item.get('client_folder', '?')}. "
                f"Plik z GDrive ID: {item.get('gdrive_file_id', '?')}."
            )
            update_payload = {
                "protocol_pdf_r2_key": r2_key,
                "protocol_pdf_url": public_url,
                "file_size_bytes": file_size,
                "source_filename": item["source_filename"],
                "protocol_number": item["protocol_number"],
                "notes": note,
            }
            if item.get("inspection_date"):
                update_payload["inspection_date"] = item["inspection_date"]

            if has_pid:
                res = (
                    sb.table("historical_protocols")
                    .update(update_payload)
                    .eq("id", item["placeholder_id"])
                    .execute()
                )
                if not res.data:
                    raise RuntimeError("UPDATE nic nie zaktualizował")
                used_id = item["placeholder_id"]
            elif existing_row:
                # Rekord istnieje (NULL plik) — UPDATE by id
                res = (
                    sb.table("historical_protocols")
                    .update(update_payload)
                    .eq("id", existing_row["id"])
                    .execute()
                )
                if not res.data:
                    raise RuntimeError("UPDATE-by-key nic nie zaktualizował")
                used_id = existing_row["id"]
            else:
                # Rekord nie istnieje — INSERT z polami klucza
                insert_payload = dict(update_payload)
                insert_payload["turbine_id"] = item["turbine_id"]
                insert_payload["year"] = item["year"]
                insert_payload["inspection_type"] = item["inspection_type"]
                res = (
                    sb.table("historical_protocols")
                    .insert(insert_payload)
                    .execute()
                )
                if not res.data:
                    raise RuntimeError("INSERT nic nie zwrócił")
                used_id = res.data[0]["id"]

            report["uploaded"].append(
                {
                    "placeholder_id": used_id,
                    "turbine_id": item["turbine_id"],
                    "turbine_label": label,
                    "protocol_number": item["protocol_number"],
                    "r2_key": r2_key,
                    "url": public_url,
                    "size_bytes": file_size,
                }
            )
            report["by_turbine"].setdefault(
                item["turbine_id"], {"label": label, "count": 0, "files": []}
            )
            report["by_turbine"][item["turbine_id"]]["count"] += 1
            report["by_turbine"][item["turbine_id"]]["files"].append(item["protocol_number"])

        except Exception as err:
            print(f"{prefix} ERROR: {err}")
            report["errors"].append(
                {
                    "placeholder_id": item.get("placeholder_id"),
                    "turbine_label": label,
                    "error": str(err),
                }
            )

    # Raport
    report["finished_at"] = datetime.now().isoformat()
    ts_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    report_path = Path(__file__).parent / "output" / f"report_batch_{ts_str}.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n" + "=" * 78)
    print(f"WYNIK: {len(report['uploaded'])} wgranych, {len(report['skipped_already_uploaded'])} pominiętych, {len(report['errors'])} błędów")
    print(f"Raport: {report_path}")

    if report["by_turbine"]:
        print("\n=== Linki weryfikacyjne (zakładka Archiwum) ===")
        for turbine_id, info in report["by_turbine"].items():
            files = ", ".join(info["files"])
            print(f"  {info['label']} ({files}): {APP_URL}/turbiny/{turbine_id}")

    sys.exit(1 if report["errors"] else 0)


if __name__ == "__main__":
    main()
