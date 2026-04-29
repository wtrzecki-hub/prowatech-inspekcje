#!/usr/bin/env python3
"""
Upload extracted turbine photos to Cloudflare R2 + UPDATE turbines.photo_url/_2/_3.

Reads scripts/output/turbine_photos_manifest.json (produced by extract_photos_2025.py).
For each entry with status="ok":
  1. PUT each of photo_1.jpg, photo_2.jpg, photo_3.jpg to R2 under
     `turbines/{turbine_id}/photo_{slot}.jpg` (overwrites — clean sweep).
  2. UPDATE turbines SET photo_url = url1, photo_url_2 = url2, photo_url_3 = url3
     WHERE id = turbine_id.
  3. Skip on error per slot, report at end.

Run from host (sandbox proxy blocks Cloudflare R2):
  cd C:\\prowatech-inspekcje
  python scripts/upload_turbine_photos.py

Optional flags:
  --limit N        process at most N entries (sanity check)
  --dry-run        do everything except PUT and UPDATE (just report)
  --turbine ID     process only one turbine_id (verification)
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

R2_ACCOUNT_ID = "587ba2347ed372341fe359b0ed2d632d"
R2_BUCKET = "prowatech-inspekcje"
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com"
R2_PUBLIC_URL = "https://pub-edbf124678454e819a88cd7054401694.r2.dev"
SUPABASE_URL = "https://lhxhsprqoecepojrxepf.supabase.co"

REPO_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = REPO_ROOT / "scripts" / "output" / "turbine_photos_manifest.json"


def load_env_local() -> dict:
    env_path = REPO_ROOT / ".env.local"
    if not env_path.exists():
        sys.exit(f"[FATAL] Brak .env.local: {env_path}")
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


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, help="Process at most N entries")
    p.add_argument("--dry-run", action="store_true", help="Do not PUT or UPDATE, just report")
    p.add_argument("--turbine", type=str, help="Process only one turbine_id (e.g. for verification)")
    args = p.parse_args()

    if not MANIFEST_PATH.exists():
        sys.exit(f"[FATAL] Brak manifestu: {MANIFEST_PATH}. Najpierw uruchom extract_photos_2025.py.")

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    items = [m for m in manifest if m.get("status") == "ok"]
    if args.turbine:
        items = [m for m in items if m["turbine_id"] == args.turbine]
    if args.limit:
        items = items[: args.limit]

    print("=" * 78)
    print(f"Upload zdjec turbin -> R2 + Supabase: {len(items)} pozycji")
    print(f"Manifest: {MANIFEST_PATH}")
    if args.dry_run:
        print("** DRY RUN ** (no PUT, no UPDATE)")
    print("=" * 78)

    env = load_env_local()
    for k in ("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "SUPABASE_SERVICE_ROLE_KEY"):
        if k not in env:
            sys.exit(f"[FATAL] Brak {k} w .env.local")

    try:
        import boto3
    except ImportError:
        sys.exit("[FATAL] pip install boto3")
    try:
        from supabase import create_client
    except ImportError:
        sys.exit("[FATAL] pip install supabase")

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
        "total": len(items),
        "uploaded_turbines": [],
        "errors": [],
    }

    for idx, item in enumerate(items, 1):
        turbine_id = item["turbine_id"]
        pn = item.get("protocol_number") or "?"
        prefix = f"[{idx}/{len(items)}]"
        try:
            files = item.get("files", [])
            if len(files) != 3:
                raise RuntimeError(f"manifest_files_count={len(files)}, expected 3")

            # Sanity: ensure all local files exist before any PUT
            files_sorted = sorted(files, key=lambda x: x["slot"])
            for f in files_sorted:
                p = REPO_ROOT / f["local_path"]
                if not p.exists():
                    raise FileNotFoundError(f"local missing: {p}")

            urls_by_slot = {}
            total_bytes = 0
            for f in files_sorted:
                slot = f["slot"]
                local_path = REPO_ROOT / f["local_path"]
                r2_key = f"turbines/{turbine_id}/photo_{slot}.jpg"
                public_url = f"{R2_PUBLIC_URL}/{encode_r2_path(r2_key)}"
                size = local_path.stat().st_size
                total_bytes += size

                if not args.dry_run:
                    with open(local_path, "rb") as fh:
                        s3.put_object(
                            Bucket=R2_BUCKET,
                            Key=r2_key,
                            Body=fh,
                            ContentType="image/jpeg",
                            CacheControl="public, max-age=31536000, immutable",
                        )
                    head = s3.head_object(Bucket=R2_BUCKET, Key=r2_key)
                    if head["ContentLength"] != size:
                        raise RuntimeError(
                            f"slot{slot} size mismatch: {head['ContentLength']} != {size}"
                        )
                urls_by_slot[slot] = public_url

            update_payload = {
                "photo_url": urls_by_slot[1],
                "photo_url_2": urls_by_slot[2],
                "photo_url_3": urls_by_slot[3],
            }

            if not args.dry_run:
                res = (
                    sb.table("turbines")
                    .update(update_payload)
                    .eq("id", turbine_id)
                    .execute()
                )
                if not res.data:
                    raise RuntimeError("UPDATE turbines nic nie zwrocilo (RLS lub bledny id?)")

            print(f"{prefix} OK {turbine_id} ({pn}) - 3 photos, {total_bytes/1024:.0f} KB")
            report["uploaded_turbines"].append(
                {
                    "turbine_id": turbine_id,
                    "protocol_number": pn,
                    "size_bytes": total_bytes,
                    "urls": urls_by_slot,
                }
            )

        except Exception as e:
            print(f"{prefix} ERROR {turbine_id} ({pn}): {e}")
            report["errors"].append(
                {"turbine_id": turbine_id, "protocol_number": pn, "error": str(e)}
            )

    report["finished_at"] = datetime.now().isoformat()
    ts_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    report_path = REPO_ROOT / "scripts" / "output" / f"report_turbine_photos_{ts_str}.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n" + "=" * 78)
    print(f"WYNIK: {len(report['uploaded_turbines'])} turbin OK, {len(report['errors'])} bledow")
    print(f"Raport: {report_path}")
    sys.exit(1 if report["errors"] else 0)


if __name__ == "__main__":
    main()
