"""
Extract 3 turbine photos from page 1 of each 2025 annual protocol PDF.

Layout on page 1 (verified on 3 sample PDFs from 2025):
  - 4 images total
  - [0] Logo ProWaTech: bbox.y < 150 (top of page)
  - [1] Portrait photo:  bbox.x < 200 (left side, lower)
  - [2] Landscape upper: bbox.x > 250, smaller bbox.y
  - [3] Landscape lower: bbox.x > 250, larger bbox.y

Mapping to turbines.photo_url / _2 / _3:
  photo_url   = portrait
  photo_url_2 = landscape upper
  photo_url_3 = landscape lower

Workflow:
  1. SELECT 2025 annual protocols with PDF URL from Supabase REST.
  2. For each: download PDF, extract 3 images, re-encode JPEG (max 1920px, q=85).
  3. Save to scripts/output/turbine_photos/{turbine_id}/photo_{1,2,3}.jpg
  4. Build manifest scripts/output/turbine_photos_manifest.json for the upload step.

Usage:
  python scripts/extract_photos_2025.py --sample        # process 3 sample PDFs already in scripts/output/sample_2025/
  python scripts/extract_photos_2025.py                 # full bulk: fetch from R2 for all 2025 annual protocols
  python scripts/extract_photos_2025.py --limit 10      # bulk but only first 10
  python scripts/extract_photos_2025.py --skip-existing # skip turbines whose output dir already has 3 jpgs
"""
import argparse
import io
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

import fitz
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "scripts" / "output" / "turbine_photos"
MANIFEST_PATH = REPO_ROOT / "scripts" / "output" / "turbine_photos_manifest.json"
SAMPLE_DIR = REPO_ROOT / "scripts" / "output" / "sample_2025"

SUPABASE_URL = "https://lhxhsprqoecepojrxepf.supabase.co"

MAX_DIM = 1920
JPEG_QUALITY = 85
LOGO_Y_THRESHOLD = 150
LEFT_X_THRESHOLD = 200
# DPI used when rendering the bbox clip from page 1.
# 220 DPI on a typical bbox (~196x313pt portrait) -> ~600x955 px, plenty for a turbine card.
RENDER_DPI = 220


def load_env() -> dict:
    """Read SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local."""
    env = {}
    env_file = REPO_ROOT / ".env.local"
    if not env_file.exists():
        return env
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def fetch_2025_protocols() -> list[dict]:
    """Fetch all 2025 annual protocols with non-null PDF via Supabase REST."""
    import urllib.request

    env = load_env()
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        sys.exit("ERROR: SUPABASE_SERVICE_ROLE_KEY must be in .env.local")

    endpoint = (
        f"{SUPABASE_URL}/rest/v1/historical_protocols"
        "?select=turbine_id,protocol_number,protocol_pdf_url,protocol_pdf_r2_key"
        "&year=eq.2025"
        "&inspection_type=eq.annual"
        "&protocol_pdf_url=not.is.null"
        "&order=turbine_id"
    )
    req = urllib.request.Request(
        endpoint,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def extract_three_images(pdf_path: Path) -> Optional[dict]:
    """
    Open PDF, find 4 images on page 1, render each to JPEG bytes via the page bbox
    (so PDF CTM rotation/transforms produce the orientation as displayed, not raw).

    Returns dict {portrait, landscape_upper, landscape_lower} -> {bbox, jpeg_bytes, w, h}.
    Returns dict with "error" key if layout doesn't match.
    """
    doc = fitz.open(pdf_path)
    if doc.page_count == 0:
        return {"error": "empty_pdf"}
    page = doc.load_page(0)
    infos = page.get_image_info(xrefs=True)
    if len(infos) < 4:
        return {"error": f"page1_has_{len(infos)}_images_expected_4"}

    # Filter out the logo (top of page)
    candidates = [i for i in infos if i.get("bbox") and i["bbox"][1] >= LOGO_Y_THRESHOLD]
    if len(candidates) < 3:
        return {"error": f"after_logo_filter_only_{len(candidates)}_images"}

    # Sort: portrait = leftmost; among the two right-side images, smaller-y is upper.
    portrait = min(candidates, key=lambda x: x["bbox"][0])
    rights = [c for c in candidates if c is not portrait]
    rights.sort(key=lambda x: x["bbox"][1])
    if len(rights) < 2:
        return {"error": "could_not_find_two_landscape_images"}
    landscape_upper, landscape_lower = rights[0], rights[1]

    zoom = RENDER_DPI / 72.0  # 72 PDF pt = 1 inch
    matrix = fitz.Matrix(zoom, zoom)

    out = {}
    for slot_name, info in [
        ("portrait", portrait),
        ("landscape_upper", landscape_upper),
        ("landscape_lower", landscape_lower),
    ]:
        bbox = info["bbox"]
        rect = fitz.Rect(*bbox)
        try:
            pix = page.get_pixmap(matrix=matrix, clip=rect, alpha=False)
            png_bytes = pix.tobytes("png")
        except Exception as e:
            return {"error": f"slot_{slot_name}_render_failed: {e}"}
        out[slot_name] = {
            "bbox": list(bbox),
            "rendered_w": pix.width,
            "rendered_h": pix.height,
            "png_bytes": png_bytes,
        }
    return out


def reencode_jpeg(image_bytes: bytes) -> tuple[bytes, int, int]:
    """Re-encode raw image bytes (PNG from pixmap) to JPEG (max 1920px, q=85)."""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    w, h = img.size
    if max(w, h) > MAX_DIM:
        ratio = MAX_DIM / max(w, h)
        new_w = round(w * ratio)
        new_h = round(h * ratio)
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        w, h = new_w, new_h

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return buf.getvalue(), w, h


def download_pdf(url: str, dst: Path, attempts: int = 3) -> bool:
    """Download URL to dst with simple retry. Returns True on success.

    R2 public URL (pub-*.r2.dev) returns 403 for default Python-urllib User-Agent;
    sending a browser-like UA bypasses the block.
    """
    import urllib.request

    last = ""
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                dst.write_bytes(r.read())
            return True
        except Exception as e:
            last = str(e)
            if attempt < attempts:
                time.sleep(1.5 * attempt)
    print(f"  download failed after {attempts} attempts: {last}")
    return False


def process_one(turbine_id: str, pdf_path: Path, protocol_number: str | None) -> dict:
    """Extract + re-encode photos for a single PDF. Returns manifest entry."""
    out_dir = OUTPUT_DIR / turbine_id
    out_dir.mkdir(parents=True, exist_ok=True)

    extracted = extract_three_images(pdf_path)
    if extracted is None or "error" in extracted:
        err = extracted.get("error") if extracted else "unknown"
        return {
            "turbine_id": turbine_id,
            "protocol_number": protocol_number,
            "status": "error",
            "error": err,
        }

    files = []
    sizes_kb = []
    for slot, slot_name in [(1, "portrait"), (2, "landscape_upper"), (3, "landscape_lower")]:
        item = extracted[slot_name]
        try:
            jpg_bytes, w, h = reencode_jpeg(item["png_bytes"])
        except Exception as e:
            return {
                "turbine_id": turbine_id,
                "protocol_number": protocol_number,
                "status": "error",
                "error": f"reencode_slot{slot}: {e}",
            }
        out_file = out_dir / f"photo_{slot}.jpg"
        out_file.write_bytes(jpg_bytes)
        files.append({
            "slot": slot,
            "local_path": str(out_file.relative_to(REPO_ROOT)),
            "width": w,
            "height": h,
            "size_bytes": len(jpg_bytes),
        })
        sizes_kb.append(len(jpg_bytes) / 1024)

    return {
        "turbine_id": turbine_id,
        "protocol_number": protocol_number,
        "status": "ok",
        "files": files,
        "sizes_kb": [round(s, 1) for s in sizes_kb],
    }


def run_sample() -> None:
    """Test on 3 sample PDFs already in scripts/output/sample_2025/."""
    samples = [
        ("011883cf-ae31-4d66-9ad1-aa55f8bcb75a", "T072_116_2025.pdf", "116/T/2025"),
        ("046b70f8-4f4b-4f84-8143-b0187442d057", "T312_106_2025.pdf", "106/T/2025"),
        ("051993d0-2ba9-4afd-be70-acaa75562b84", "T317_59_2025.pdf", "59/T/2025"),
    ]
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    for turbine_id, fname, pn in samples:
        path = SAMPLE_DIR / fname
        if not path.exists():
            print(f"SKIP missing sample: {path}")
            continue
        print(f"Processing {fname} -> turbine {turbine_id}")
        r = process_one(turbine_id, path, pn)
        results.append(r)
        if r["status"] == "ok":
            print(f"  OK: {r['sizes_kb']} KB | files in {OUTPUT_DIR / turbine_id}")
        else:
            print(f"  ERROR: {r['error']}")

    print(f"\nResult JSON:")
    print(json.dumps(results, indent=2, ensure_ascii=False))


def run_bulk(limit: int | None, skip_existing: bool) -> None:
    """Full bulk run: fetch protocol list, download PDFs, extract photos."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    protocols = fetch_2025_protocols()
    print(f"Fetched {len(protocols)} 2025 annual protocols with PDFs")
    if limit:
        protocols = protocols[:limit]
        print(f"Limit applied: processing {len(protocols)} entries")

    tmp_dir = REPO_ROOT / "scripts" / "output" / "_tmp_pdfs_2025"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    results = []
    started = time.time()
    for i, p in enumerate(protocols, 1):
        turbine_id = p["turbine_id"]
        pn = p.get("protocol_number")
        url = p.get("protocol_pdf_url")

        out_dir = OUTPUT_DIR / turbine_id
        if skip_existing and all((out_dir / f"photo_{n}.jpg").exists() for n in (1, 2, 3)):
            print(f"[{i}/{len(protocols)}] skip existing: {turbine_id}")
            results.append({
                "turbine_id": turbine_id, "protocol_number": pn,
                "status": "skipped_existing",
            })
            continue

        if not url:
            results.append({
                "turbine_id": turbine_id, "protocol_number": pn,
                "status": "error", "error": "no_url",
            })
            continue

        pdf_path = tmp_dir / f"{turbine_id}.pdf"
        if not pdf_path.exists():
            print(f"[{i}/{len(protocols)}] download {pn}")
            if not download_pdf(url, pdf_path):
                results.append({
                    "turbine_id": turbine_id, "protocol_number": pn,
                    "status": "error", "error": "download_failed",
                })
                continue

        r = process_one(turbine_id, pdf_path, pn)
        results.append(r)
        if r["status"] == "ok":
            print(f"  -> OK {r['sizes_kb']} KB")
        else:
            print(f"  -> ERROR {r.get('error')}")

        # Free disk: delete the per-turbine PDF after successful processing.
        if r["status"] == "ok":
            try:
                pdf_path.unlink()
            except Exception:
                pass

    elapsed = time.time() - started
    ok = sum(1 for r in results if r["status"] == "ok")
    err = sum(1 for r in results if r["status"] == "error")
    skipped = sum(1 for r in results if r["status"] == "skipped_existing")
    print(f"\nDone in {elapsed:.1f}s. OK={ok}, errors={err}, skipped={skipped}")

    MANIFEST_PATH.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Manifest written: {MANIFEST_PATH}")

    # Cleanup tmp dir if empty
    try:
        tmp_dir.rmdir()
    except OSError:
        pass


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--sample", action="store_true", help="Process the 3 sample PDFs only")
    p.add_argument("--limit", type=int, help="Process at most N protocols")
    p.add_argument("--skip-existing", action="store_true",
                   help="Skip turbines whose output dir already has photo_1/2/3.jpg")
    args = p.parse_args()

    if args.sample:
        run_sample()
    else:
        run_bulk(args.limit, args.skip_existing)


if __name__ == "__main__":
    main()
