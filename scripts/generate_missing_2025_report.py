"""Generate PDF report — turbiny bez protokołu rocznego 2025 w archiwum cyfrowym.

Czyta dane z:
  - scripts/output/manifest_2025_full_dryrun.json (lista 66 brakujących + 5 budynków + alternative naming)
  - scripts/output/excel_2025_matched.json (376 turbin z arkusza dla wzbogacenia serial_number)

Output: Brakujace_protokoly_2025.pdf
"""

import json
import os
from pathlib import Path
from collections import defaultdict
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Fonts ──────────────────────────────────────────────────────────
PROJECT = Path(__file__).resolve().parent.parent
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

# ── Klienci u których folder GDrive 2025 ma tylko zdjęcia (brak PDF protokołów) ──
NO_PROTOCOLS_FOLDER_CLIENTS = {
    "JANIKOWO GP GMBH SPÓŁKA KOMANDYTOWA",  # folder /WTG XX -YYY/ z samymi JPG
}

# ── Style ──────────────────────────────────────────────────────────
PRIMARY = colors.HexColor("#259648")
PRIMARY_LIGHT = colors.HexColor("#E8F5EC")
GRAPHITE_900 = colors.HexColor("#1F2937")
GRAPHITE_700 = colors.HexColor("#374151")
GRAPHITE_500 = colors.HexColor("#6B7280")
GRAPHITE_200 = colors.HexColor("#E5E7EB")
GRAPHITE_50 = colors.HexColor("#F9FAFB")
WARNING_BG = colors.HexColor("#FEF3C7")
WARNING_TEXT = colors.HexColor("#92400E")
INFO_BG = colors.HexColor("#DBEAFE")
INFO_TEXT = colors.HexColor("#1E40AF")
DANGER_BG = colors.HexColor("#FEE2E2")
DANGER_TEXT = colors.HexColor("#991B1B")

styles = getSampleStyleSheet()

H1 = ParagraphStyle(
    "H1", parent=styles["Heading1"],
    fontName=BOLD_FONT, fontSize=22, leading=28,
    textColor=GRAPHITE_900, spaceAfter=8,
)
H2 = ParagraphStyle(
    "H2", parent=styles["Heading2"],
    fontName=BOLD_FONT, fontSize=14, leading=18,
    textColor=PRIMARY, spaceBefore=12, spaceAfter=6,
)
H3 = ParagraphStyle(
    "H3", parent=styles["Heading3"],
    fontName=BOLD_FONT, fontSize=11, leading=14,
    textColor=GRAPHITE_900, spaceBefore=8, spaceAfter=3,
)
NORMAL = ParagraphStyle(
    "Normal", parent=styles["Normal"],
    fontName=BASE_FONT, fontSize=10, leading=14,
    textColor=GRAPHITE_700,
)
SMALL = ParagraphStyle(
    "Small", parent=NORMAL,
    fontSize=8.5, leading=11, textColor=GRAPHITE_500,
)
CHIP_NOFILE = ParagraphStyle(
    "ChipNoFile", parent=NORMAL,
    fontSize=8, leading=10, textColor=WARNING_TEXT,
    backColor=WARNING_BG, borderPadding=2, alignment=1,
)
CHIP_NOFOLDER = ParagraphStyle(
    "ChipNoFolder", parent=NORMAL,
    fontSize=8, leading=10, textColor=DANGER_TEXT,
    backColor=DANGER_BG, borderPadding=2, alignment=1,
)
CHIP_BUILDING = ParagraphStyle(
    "ChipBuilding", parent=NORMAL,
    fontSize=8, leading=10, textColor=INFO_TEXT,
    backColor=INFO_BG, borderPadding=2, alignment=1,
)


def header(canvas, doc):
    canvas.saveState()
    canvas.setFont(BASE_FONT, 8)
    canvas.setFillColor(GRAPHITE_500)
    canvas.drawString(15 * mm, 10 * mm, f"Prowatech Inspekcje · Brakujące protokoły 2025 · {date.today().isoformat()}")
    canvas.drawRightString(195 * mm, 10 * mm, f"Strona {doc.page}")
    canvas.restoreState()


def status_chip(status: str) -> Paragraph:
    if status == "no_folder":
        return Paragraph("Folder GDrive bez protokołów", CHIP_NOFOLDER)
    if status == "building":
        return Paragraph("Budynek techniczny (poza arkuszem)", CHIP_BUILDING)
    return Paragraph("Brak pliku w archiwum", CHIP_NOFILE)


def build_client_section(client_name: str, rows: list, status: str, columns=None):
    """Sekcja per klient: header + chip + tabela. rows = list[tuple]."""
    elements = []
    elements.append(Paragraph(f"<b>{client_name}</b> — {len(rows)} pozycji", H3))

    chip_table = Table(
        [[status_chip(status)]],
        colWidths=[60 * mm],
        rowHeights=[6 * mm],
    )
    chip_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(chip_table)
    elements.append(Spacer(1, 2 * mm))

    if columns is None:
        columns = ["Turbina", "Farma", "Oznaczenie EW", "Nr seryjny", "Nr protokołu (oczek.)"]

    table_rows = [columns]
    for row in rows:
        table_rows.append(list(row))

    if len(columns) == 5:
        col_widths = [36 * mm, 40 * mm, 38 * mm, 30 * mm, 36 * mm]
    elif len(columns) == 4:
        col_widths = [44 * mm, 50 * mm, 48 * mm, 38 * mm]
    else:
        col_widths = [180 * mm / len(columns)] * len(columns)

    table = Table(table_rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), BOLD_FONT),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5),
        ("BACKGROUND", (0, 0), (-1, 0), GRAPHITE_50),
        ("TEXTCOLOR", (0, 0), (-1, 0), GRAPHITE_700),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
        ("TOPPADDING", (0, 0), (-1, 0), 4),
        ("FONTNAME", (0, 1), (-1, -1), BASE_FONT),
        ("FONTSIZE", (0, 1), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 1), (-1, -1), GRAPHITE_900),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRAPHITE_50]),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, GRAPHITE_200),
        ("LINEBELOW", (0, 1), (-1, -2), 0.25, GRAPHITE_200),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAPHITE_200),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 1), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 4 * mm))
    return KeepTogether(elements)


def main():
    output = PROJECT / "Brakujace_protokoly_2025.pdf"

    # Wczytaj dane
    dryrun = json.loads((PROJECT / "scripts/output/manifest_2025_full_dryrun.json").read_text(encoding="utf-8"))
    excel_rows = json.loads((PROJECT / "scripts/output/excel_2025_matched.json").read_text(encoding="utf-8"))
    by_proto = {row["protocol_number_short"]: row for row in excel_rows}

    # Sekcja A: brakujące turbiny z arkusza (66) — wzbogać o serial_number z arkusza
    missing_by_client = defaultdict(list)
    for m in dryrun["missing_from_excel"]:
        excel_row = by_proto.get(m["protocol_number_short"], {})
        sn = excel_row.get("serial_number_excel", "—")
        # Status: czy klient w NO_PROTOCOLS_FOLDER_CLIENTS
        status = "no_folder" if m["client_name"] in NO_PROTOCOLS_FOLDER_CLIENTS else "no_file"
        row = (
            excel_row.get("turbine_code", "?"),
            m["farm_name"],
            excel_row.get("ew_designation_db", "—"),
            sn or "—",
            m["protocol_number_full"],
        )
        missing_by_client[(m["client_name"], status)].append(row)

    # Sortowanie wewnątrz klienta po turbine_code
    for key in missing_by_client:
        missing_by_client[key].sort(key=lambda r: r[0])

    # Sekcja B: 5 protokołów budynków technicznych (z unmatched_no_excel)
    buildings = []
    for e in dryrun.get("unmatched_no_excel", []):
        # Format: 185_T_2025 PROTOKÓŁ kontroli rocznej_budynek TR2 Bęcino_29-05-2025.pdf
        buildings.append((
            e["protocol_number_short"],
            e["filename"][:80],
            e["rel_path"].split(os.sep)[0][:60],
        ))

    # Stats
    no_folder_count = sum(len(rows) for (c, s), rows in missing_by_client.items() if s == "no_folder")
    no_file_count = sum(len(rows) for (c, s), rows in missing_by_client.items() if s == "no_file")
    total_missing = no_folder_count + no_file_count

    no_folder_clients = sorted({c for (c, s) in missing_by_client if s == "no_folder"})
    no_file_clients = sorted({c for (c, s) in missing_by_client if s == "no_file"})

    doc = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=18 * mm,
        title="Brakujące protokoły 2025 — Prowatech Inspekcje",
        author="ProWaTech Sp. z o.o.",
    )

    story = []

    # Title
    story.append(Paragraph("Brakujące protokoły kontroli rocznej 2025", H1))
    story.append(Paragraph(
        f"Stan archiwum cyfrowego ProWaTech na dzień {date.today().strftime('%d.%m.%Y')}.",
        NORMAL,
    ))
    story.append(Spacer(1, 6 * mm))

    # Summary
    matched_count = dryrun["matched_count"]
    summary_rows = [
        ["Łączna liczba turbin w arkuszu 2025", str(dryrun["total_excel_rows"])],
        ["Pliki PDF znalezione w GDrive 2025", str(dryrun["total_pdf_files_scanned"])],
        ["Pominięte (subfolder 2024 / non-protocol / pomiarowe)",
         f'{dryrun["skip_2024_in_2025_count"] + dryrun["non_protocol_skipped_count"]}'],
        ["Zmatchowane do arkusza (wgrane do bazy)",
         f'{matched_count} / {dryrun["total_excel_rows"]}  ({100*matched_count/dryrun["total_excel_rows"]:.1f} %)'],
        ["Brakujące protokoły z arkusza", f"{total_missing}"],
        ["— folder GDrive bez protokołów (tylko zdjęcia)",
         f"{no_folder_count}  ({len(no_folder_clients)} klientów)"],
        ["— brak pliku w archiwum cyfrowym",
         f"{no_file_count}  ({len(no_file_clients)} klientów)"],
        ["Protokoły budynków technicznych (poza arkuszem)", f"{len(buildings)}"],
    ]
    summary = Table(summary_rows, colWidths=[110 * mm, 60 * mm])
    summary.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), BASE_FONT),
        ("FONTNAME", (1, 0), (1, -1), BOLD_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 0), (0, -1), GRAPHITE_700),
        ("TEXTCOLOR", (1, 0), (1, -1), GRAPHITE_900),
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, PRIMARY),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, GRAPHITE_200),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(summary)
    story.append(Spacer(1, 6 * mm))

    # Legenda
    story.append(Paragraph("Legenda statusów:", H3))
    legend_rows = [
        [status_chip("no_folder"), Paragraph(
            "Folder klienta w GDrive 2025 istnieje, ale zawiera tylko subfoldery "
            "ze zdjęciami z przeglądu — brak plików PDF protokołów rocznych. "
            "Protokoły mogą być w innej, samodzielnej lokalizacji GDrive (analogicznie "
            "do FW Żary, którego protokoły 2025 zlokalizowano poza standardową hierarchią).",
            NORMAL)],
        [status_chip("no_file"), Paragraph(
            "Brak pliku w GDrive 2025 ani w innej znanej lokalizacji. Operator "
            "albo nie wykonał kontroli rocznej w 2025, albo trzyma plik "
            "w archiwum poza zasięgiem ProWaTech.",
            NORMAL)],
        [status_chip("building"), Paragraph(
            "Plik istnieje w GDrive 2025 i wygląda na protokół roczny, ale dotyczy "
            "budynku technicznego (transformator TR1/TR2, budynek BKR), "
            "którego nie ma w arkuszu turbin operatora.",
            NORMAL)],
    ]
    legend = Table(legend_rows, colWidths=[42 * mm, 138 * mm])
    legend.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(legend)
    story.append(Spacer(1, 6 * mm))

    # Section A — Folder GDrive bez protokołów
    if no_folder_clients:
        story.append(Paragraph(
            f"A. Klienci których folder GDrive 2025 nie zawiera plików protokołów — "
            f"{no_folder_count} turbin u {len(no_folder_clients)} klientów",
            H2,
        ))
        story.append(Paragraph(
            "Folder klienta w drzewie <font name='%s'>04 Inspekcje/2025</font> "
            "istnieje, ale zawiera tylko subfoldery ze zdjęciami z przeglądu (JPG). "
            "Brak plików PDF protokołów rocznych. Sugestia: zapytać operatora "
            "o lokalizację archiwum protokołów 2025 (analogicznie jak rozwiązano "
            "FW Żary, którego protokoły zlokalizowano w samodzielnym folderze GDrive)."
            % BASE_FONT,
            NORMAL,
        ))
        story.append(Spacer(1, 3 * mm))
        for client in no_folder_clients:
            rows = missing_by_client.get((client, "no_folder"), [])
            story.append(build_client_section(client, rows, "no_folder"))
        story.append(PageBreak())

    # Section B — brak pliku w archiwum
    if no_file_clients:
        story.append(Paragraph(
            f"B. Turbiny bez pliku w archiwum cyfrowym — "
            f"{no_file_count} turbin u {len(no_file_clients)} klientów",
            H2,
        ))
        story.append(Paragraph(
            "Dla tych turbin nie znaleziono protokołu kontroli rocznej 2025 ani "
            "w GDrive 2025, ani w żadnej innej znanej lokalizacji. Możliwe przyczyny: "
            "kontrola nie została jeszcze wykonana, plik jest u operatora poza zasięgiem "
            "ProWaTech, lub został umieszczony w innym folderze.",
            NORMAL,
        ))
        story.append(Spacer(1, 3 * mm))
        for client in no_file_clients:
            rows = missing_by_client.get((client, "no_file"), [])
            story.append(build_client_section(client, rows, "no_file"))

    # Section C — budynki techniczne
    if buildings:
        story.append(PageBreak())
        story.append(Paragraph(
            f"C. Protokoły budynków technicznych poza arkuszem turbin — {len(buildings)} pozycji",
            H2,
        ))
        story.append(Paragraph(
            "W GDrive 2025 znaleziono protokoły roczne dotyczące budynków technicznych "
            "(transformatory TR1/TR2, budynki BKR), które nie mają odpowiednika w "
            "arkuszu turbin operatora. Decyzja: czy rejestrować je w bazie jako oddzielne "
            "obiekty (osobna tabela / typ obiektu), czy pominąć.",
            NORMAL,
        ))
        story.append(Spacer(1, 3 * mm))
        story.append(build_client_section(
            "EW DAMASŁAWEK Sp. z o.o. — POTEGOWO MASHAV (Bęcino, Wrzeście)",
            buildings,
            "building",
            columns=["Nr protokołu", "Nazwa pliku", "Folder klienta"],
        ))

    doc.build(story, onFirstPage=header, onLaterPages=header)
    size_kb = os.path.getsize(output) / 1024
    print(f"OK  {output.name}  ({size_kb:.1f} KB)")
    print(f"\nPodsumowanie:")
    print(f"  Brakujące protokoły z arkusza:           {total_missing}")
    print(f"  - Folder GDrive bez protokołów:          {no_folder_count} ({len(no_folder_clients)} klientów)")
    print(f"  - Brak pliku w archiwum:                 {no_file_count} ({len(no_file_clients)} klientów)")
    print(f"  Protokoły budynków technicznych:         {len(buildings)}")


if __name__ == "__main__":
    main()
