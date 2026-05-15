#!/usr/bin/env python3
"""Sprawdza zawartość defect_library + sample wpisów."""
import io
import sys
from pathlib import Path

from supabase import create_client

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)

ENV_FILE = Path(r"C:\prowatech-inspekcje\.env.local")
SUPABASE_URL = "https://lhxhsprqoecepojrxepf.supabase.co"


def load_env(path):
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def main():
    env = load_env(ENV_FILE)
    sb = create_client(SUPABASE_URL, env["SUPABASE_SERVICE_ROLE_KEY"])
    res = (
        sb.table("defect_library")
        .select("element_number,name_pl,recommendation_template,is_active")
        .eq("is_active", True)
        .order("element_number")
        .execute()
    )
    rows = res.data or []
    print(f"Aktywnych defektów: {len(rows)}\n")

    by_elem: dict[int, list] = {}
    for r in rows:
        by_elem.setdefault(r.get("element_number") or 0, []).append(r)

    for elem in sorted(by_elem.keys()):
        print(f"== Element #{elem} ({len(by_elem[elem])} defektów) ==")
        for r in by_elem[elem][:3]:
            print(f"  - {r['name_pl']}")
            rt = r.get("recommendation_template")
            if rt:
                rt_short = rt[:120] + ("…" if len(rt) > 120 else "")
                print(f"      → tpl: {rt_short}")
        if len(by_elem[elem]) > 3:
            print(f"  … i {len(by_elem[elem]) - 3} więcej")
        print()

    # Teraz check: ile previous_recommendations (status='nie') ma match w defect_library
    print("=" * 70)
    res2 = (
        sb.table("previous_recommendations")
        .select("recommendation_text,element_name,completion_status")
        .eq("completion_status", "nie")
        .limit(100)
        .execute()
    )
    prev = res2.data or []
    print(f"\nPrevious_recommendations (status='nie', limit 100): {len(prev)}")

    templates = {r["recommendation_template"]: r["name_pl"] for r in rows if r.get("recommendation_template")}
    matched = 0
    for p in prev:
        text = (p.get("recommendation_text") or "").strip()
        if text in templates:
            matched += 1
    print(f"Dokładny match recommendation_text → defect_library.recommendation_template: {matched}/{len(prev)}")

    # Sample niematchowanych
    unmatched_sample = []
    for p in prev:
        text = (p.get("recommendation_text") or "").strip()
        if text not in templates:
            unmatched_sample.append(text)
        if len(unmatched_sample) >= 5:
            break
    if unmatched_sample:
        print("\nPrzykładowe NIE-matchowane teksty:")
        for t in unmatched_sample:
            print(f"  • {t[:140]}")


if __name__ == "__main__":
    main()
