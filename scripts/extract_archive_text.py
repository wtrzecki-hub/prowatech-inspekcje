#!/usr/bin/env python3
"""
Wyciąga pełny tekst z archiwalnych PDF (sample 2025) i zapisuje jako .txt
obok każdego PDF — żeby łatwo szukać "opisów stanu technicznego" per element.
"""
import io
import sys
from pathlib import Path

import fitz

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)

ROOT = Path(__file__).parent.parent
SAMPLE_DIR = ROOT / "scripts/output/archiwum_2025_sample"


def main():
    pdfs = sorted(SAMPLE_DIR.glob("*.pdf"))
    if not pdfs:
        sys.exit(f"[FATAL] Brak PDF-ów w {SAMPLE_DIR}")

    for pdf in pdfs:
        print(f"[read] {pdf.name}")
        doc = fitz.open(str(pdf))
        text_parts: list[str] = []
        for page_no, page in enumerate(doc, start=1):
            text_parts.append(f"\n\n===== PAGE {page_no} =====\n")
            text_parts.append(page.get_text("text"))
        doc.close()
        out_path = pdf.with_suffix(".txt")
        out_path.write_text("".join(text_parts), encoding="utf-8")
        print(f"       -> {out_path.name} ({out_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
