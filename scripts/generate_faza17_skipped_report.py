"""Generate PDF report — turbiny pominięte przy Fazie 17 (auto-ekstrakcja zdjęć z PDF 2025).

Pobiera live z Supabase REST listę turbin które po Fazie 17 nadal nie mają kompletu
3 zdjęć (`photo_url`, `photo_url_2`, `photo_url_3`) — wszystkie z reason `no_2025_record`
(brak wpisu w `historical_protocols` dla 2025 annual).

Output: Faza17_pominiete_turbiny.pdf (root repo)
"""

import json
import sys
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

PROJECT = Path(__file__).resolve().parent.parent
SUPABASE_URL = "https://lhxhsprqoecepojrxepf.supabase.co"

FONT_REG = PROJECT / "src" / "fonts" / "Roboto-Regular.ttf"
FONT_BOLD = PROJECT / "src" / "fonts" / "Roboto-Bold.ttf"
if FONT_REG.exists():
    pdfmetrics.registerFont(TTFont("Roboto", str(FONT_REG)))
    pdfmetrics.registerFont(TTFont("Roboto-Bold", str(FONT_BOLD)))
    BASE_FONT = "Roboto"
    BOLD_FONT = "Roboto-Bold"
else:
    BASE_FONT = "Helvetica"
    BOLD_FONT = "Helvetica-Bold"

PRIMARY = colors.HexColor("#259648")
PRIMARY_LIGHT = colors.HexColor("#E8F5EC")
GRAPHITE_900 = colors.HexColor("#1F2937")
GRAPHITE_700 = colors.HexColor("#374151")
GRAPHITE_500 = colors.HexColor("#6B7280")
GRAPHITE_200 = colors.HexColor("#E5E7EB")
GRAPHITE_50 = colors.HexColor("#F9FAFB")
WARNING_BG = colors.HexColor("#FEF3C7")
WARNING_TEXT = colors.HexColor("#92400E")

styles = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName=BOLD_FONT,
                    fontSize=22, leading=28, textColor=GRAPHITE_900, spaceAfter=8)
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName=BOLD_FONT,
                    fontSize=14, leading=18, textColor=PRIMARY, spaceBefore=14, spaceAfter=6)
H3 = ParagraphStyle("H3", parent=styles["Heading3"], fontName=BOLD_FONT,
                    fontSize=11, leading=14, textColor=GRAPHITE_900, spaceBefore=8, spaceAfter=3)
NORMAL = ParagraphStyle("Normal", parent=styles["Normal"], fontName=BASE_FONT,
                        fontSize=10, leading=14, textColor=GRAPHITE_700)
SMALL = ParagraphStyle("Small", parent=NORMAL, fontSize=8.5, leading=11, textColor=GRAPHITE_500)
CHIP = ParagraphStyle("Chip", parent=NORMAL, fontSize=8, leading=10,
                      textColor=WARNING_TEXT, backColor=WARNING_BG, borderPadding=2, alignment=1)


def load_env() -> dict:
    env_path = PROJECT / ".env.local"
    if not env_path.exists():
        sys.exit(f"[FATAL] Brak {env_path}")
    env = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def fetch_skipped_turbines(service_role_key: str) -> list[dict]:
    """Fetch turbines without complete photo set, with farm + client embedded."""
    endpoint = (
        f"{SUPABASE_URL}/rest/v1/turbines"
        "?select=turbine_code,ew_designation,photo_url,photo_url_2,photo_url_3,"
        "wind_farms(name,clients(name))"
        "&order=turbine_code"
    )
    req = urllib.request.Request(
        endpoint,
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        rows = json.loads(r.read())

    skipped = []
    for r in rows:
        if r.get("photo_url") and r.get("photo_url_2") and r.get("photo_url_3"):
            continue
        wf = r.get("wind_farms") or {}
        cl = (wf.get("clients") or {}) if wf else {}
        skipped.append({
            "turbine_code": r["turbine_code"] or "—",
            "ew_designation": r.get("ew_designation") or "—",
            "wind_farm": wf.get("name", "—"),
            "client": cl.get("name", "—"),
        })
    return skipped


def header(canvas, doc):
    canvas.saveState()
    canvas.setFont(BASE_FONT, 8)
    canvas.setFillColor(GRAPHITE_500)
    canvas.drawString(15 * mm, 10 * mm,
                      f"Prowatech Inspekcje · Faza 17 — turbiny pominięte · {date.today().isoformat()}")
    canvas.drawRightString(195 * mm, 10 * mm, f"Strona {doc.page}")
    canvas.restoreState()


def build_client_section(client_name: str, rows: list[dict]) -> KeepTogether:
    farm_summary = ", ".join(sorted({r["wind_farm"] for r in rows}))
    elements = [
        Paragraph(f"<b>{client_name}</b> — {len(rows)} turbin",
                  ParagraphStyle("ClientH", parent=H3, spaceBefore=10)),
        Paragraph(f"Farma: {farm_summary}", SMALL),
        Spacer(1, 2 * mm),
    ]

    table_rows = [["Kod turbiny", "Oznaczenie EW", "Lokalizacja", "Farma"]]
    for r in sorted(rows, key=lambda x: x["turbine_code"]):
        # turbine_code format: T<NNN>-<Lokalizacja>; rozbij dla czytelności
        code = r["turbine_code"]
        loc = "—"
        if "-" in code:
            parts = code.split("-", 1)
            code, loc = parts[0], parts[1]
        table_rows.append([code, r["ew_designation"], loc, r["wind_farm"]])

    table = Table(table_rows, colWidths=[28 * mm, 36 * mm, 56 * mm, 60 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), BOLD_FONT),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5),
        ("BACKGROUND", (0, 0), (-1, 0), GRAPHITE_50),
        ("TEXTCOLOR", (0, 0), (-1, 0), GRAPHITE_700),
        ("FONTNAME", (0, 1), (-1, -1), BASE_FONT),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("TEXTCOLOR", (0, 1), (-1, -1), GRAPHITE_900),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRAPHITE_50]),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, GRAPHITE_200),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAPHITE_200),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 3 * mm))
    return KeepTogether(elements)


def main():
    env = load_env()
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        sys.exit("[FATAL] Brak SUPABASE_SERVICE_ROLE_KEY w .env.local")

    print("Fetching turbines without photo set...")
    skipped = fetch_skipped_turbines(key)
    print(f"Found {len(skipped)} skipped turbines")

    by_client: dict[str, list[dict]] = defaultdict(list)
    for r in skipped:
        by_client[r["client"]].append(r)

    # Sortowanie klientów po liczbie pominiętych DESC
    clients_sorted = sorted(by_client.keys(), key=lambda c: (-len(by_client[c]), c))

    # Build PDF
    output = PROJECT / "Faza17_pominiete_turbiny.pdf"
    doc = SimpleDocTemplate(
        str(output), pagesize=A4,
        topMargin=18 * mm, bottomMargin=18 * mm,
        leftMargin=15 * mm, rightMargin=15 * mm,
        title="Faza 17 — turbiny pominięte",
        author="Prowatech Inspekcje",
    )

    story = []
    story.append(Paragraph("Faza 17 — turbiny pominięte", H1))
    story.append(Paragraph(
        f"Auto-ekstrakcja 3 zdjęć ze strony tytułowej protokołów PIIB 2025 → karta turbiny. "
        f"Raport wygenerowany {date.today().isoformat()}.",
        NORMAL,
    ))
    story.append(Spacer(1, 4 * mm))

    # Tabela podsumowania
    summary_rows = [
        ["Łącznie turbin w bazie", "425"],
        ["Z kompletem 3 zdjęć z R2 (Faza 17)", str(425 - len(skipped))],
        ["Pominiętych", str(len(skipped))],
    ]
    summary = Table(summary_rows, colWidths=[100 * mm, 40 * mm])
    summary.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), BASE_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), GRAPHITE_700),
        ("TEXTCOLOR", (1, 0), (1, -1), GRAPHITE_900),
        ("FONTNAME", (1, 0), (1, -1), BOLD_FONT),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAPHITE_200),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, GRAPHITE_200),
        ("BACKGROUND", (0, -1), (-1, -1), PRIMARY_LIGHT),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(summary)
    story.append(Spacer(1, 6 * mm))

    # Powód
    story.append(Paragraph("Powód pominięcia", H2))
    story.append(Paragraph(
        "Wszystkie turbiny pominięte z jednego powodu: <b>brak wpisu w historical_protocols "
        "dla year=2025 AND inspection_type='annual'</b>. To znaczy, że dla tych turbin "
        "operator nie wykazał kontroli rocznej za rok 2025 w arkuszu "
        "<i>Zestawienie_turbin_przeglądy_2026</i>, z którego pochodzą placeholdery 2025. "
        "Bez protokołu PIIB 2025 — brak źródła zdjęć (skrypt ekstrahuje zdjęcia z karty "
        "tytułowej PDF protokołu).",
        NORMAL,
    ))
    story.append(Spacer(1, 4 * mm))

    chip_table = Table([[Paragraph("Reason: no_2025_record", CHIP)]],
                       colWidths=[60 * mm], rowHeights=[6 * mm])
    chip_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(chip_table)
    story.append(Spacer(1, 6 * mm))

    # Lista per klient
    story.append(Paragraph("Lista turbin pominiętych (zgrupowana per klient)", H2))
    for client in clients_sorted:
        story.append(build_client_section(client, by_client[client]))

    # Co dalej
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Co dalej (opcje)", H2))
    options = [
        "<b>1. Zapytaj operatorów o status kontroli 2025</b> — dla każdego z tych klientów ustal "
        "czy kontrola roczna 2025 została wykonana. Jeśli tak — zażądaj PDF i wgraj przez UI "
        "Archiwum (<i>/turbiny/[id]</i> → tab Archiwum → drag-drop). Parser nazwy auto-fillem "
        "wypełni rok / typ / numer / datę.",

        "<b>2. Re-run pipeline Fazy 17 po wgraniu PDF</b> — skrypty są idempotentne. "
        "<font name='Roboto'>python scripts/extract_photos_2025.py --skip-existing</font> + "
        "<font name='Roboto'>python scripts/upload_turbine_photos.py</font> "
        "podchwycą tylko nowe wpisy (te które dzisiaj były pominięte).",

        "<b>3. Ręczny upload zdjęć w karcie turbiny</b> — dla małych liczb (np. 2 turbiny "
        "FW Działdowo) szybsze niż pipeline. UI <i>/turbiny/[id]</i> ma osobny upload zdjęć "
        "(3 sloty: portret + 2 pejzaże).",

        "<b>4. Zostaw bez zdjęć</b> — jeśli operator nie wykonał inspekcji 2025, brak źródła "
        "zdjęć z karty tytułowej protokołu PIIB. Karta turbiny w aplikacji pokaże empty state "
        "&bdquo;brak zdjęcia&rdquo; — UI Faza 14 to obsługuje bez błędu.",
    ]
    for opt in options:
        story.append(Paragraph(opt, NORMAL))
        story.append(Spacer(1, 2 * mm))

    doc.build(story, onFirstPage=header, onLaterPages=header)
    size_kb = output.stat().st_size / 1024
    print(f"Wrote {output} ({size_kb:.1f} KB, {len(clients_sorted)} klientów, {len(skipped)} turbin)")


if __name__ == "__main__":
    main()
