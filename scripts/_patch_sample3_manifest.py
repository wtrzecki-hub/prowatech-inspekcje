"""One-shot: build manifest for 3 sample turbines skipped by --skip-existing in the bulk run."""
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
samples = [
    "011883cf-ae31-4d66-9ad1-aa55f8bcb75a",
    "046b70f8-4f4b-4f84-8143-b0187442d057",
    "051993d0-2ba9-4afd-be70-acaa75562b84",
]
out = []
for tid in samples:
    files = []
    for slot in (1, 2, 3):
        p = REPO_ROOT / "scripts" / "output" / "turbine_photos" / tid / f"photo_{slot}.jpg"
        if not p.exists():
            print(f"MISSING {p}")
            continue
        files.append({
            "slot": slot,
            "local_path": str(p.relative_to(REPO_ROOT)).replace("\\", "/"),
            "size_bytes": p.stat().st_size,
        })
    out.append({"turbine_id": tid, "protocol_number": "sample", "status": "ok", "files": files})

dst = REPO_ROOT / "scripts" / "output" / "turbine_photos_manifest_sample3.json"
dst.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Wrote {dst} with {len(out)} items")
