#!/usr/bin/env python3
"""Wypisuje listę 18 elementów PIIB z `inspection_element_definitions`."""
import io
import sys
from pathlib import Path

from supabase import create_client

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)

ENV_FILE = Path(r"C:\prowatech-inspekcje\.env.local")
SUPABASE_URL = "https://lhxhsprqoecepojrxepf.supabase.co"


def load_env(path: Path) -> dict[str, str]:
    out = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
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
        sb.table("inspection_element_definitions")
        .select(
            "element_number,name_pl,name_short,section_code,applies_to_annual,applies_to_five_year,is_active"
        )
        .eq("is_active", True)
        .order("element_number")
        .execute()
    )
    rows = res.data or []
    print(f"Aktywnych element_definitions: {len(rows)}\n")
    print(
        f"{'nr':>3} | {'roczny':>6} | {'5letni':>6} | {'kod':<6} | {'name_short':<22} | name_pl"
    )
    print("-" * 110)
    for r in rows:
        print(
            f"{r['element_number']:>3} | "
            f"{'tak' if r.get('applies_to_annual') else '—':>6} | "
            f"{'tak' if r.get('applies_to_five_year') else '—':>6} | "
            f"{r.get('section_code') or '—':<6} | "
            f"{(r.get('name_short') or '—'):<22} | "
            f"{r['name_pl']}"
        )


if __name__ == "__main__":
    main()
