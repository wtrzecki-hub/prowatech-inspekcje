"""Generate PDF report — turbiny bez protokołu rocznego 2023 w archiwum cyfrowym.

Czyta dane z scripts/output/manifest_2023_full_dryrun.json:
  - 81 missing_placeholders (turbiny których pliku nie znaleziono)
  - 31 multi_match (pliki w GDrive, niejednoznaczny match)
  - 25 no_ew_match (pliki w GDrive, brak kandydata turbiny)

Output: Brakujace_protokoly_2023.pdf
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

H1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName=BOLD_FONT,
                    fontSize=22, leading=28, textColor=GRAPHITE_900, spaceAfter=8)
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName=BOLD_FONT,
                    fontSize=14, leading=18, textColor=PRIMARY, spaceBefore=12, spaceAfter=6)
H3 = ParagraphStyle("H3", parent=styles["Heading3"], fontName=BOLD_FONT,
                    fontSize=11, leading=14, textColor=GRAPHITE_900, spaceBefore=8, spaceAfter=3)
NORMAL = ParagraphStyle("Normal", parent=styles["Normal"], fontName=BASE_FONT,
                        fontSize=10, leading=14, textColor=GRAPHITE_700)
SMALL = ParagraphStyle("Small", parent=NORMAL, fontSize=8.5, leading=11, textColor=GRAPHITE_500)
CHIP_NOFILE = ParagraphStyle("ChipNoFile", parent=NORMAL, fontSize=8, leading=10,
                             textColor=WARNING_TEXT, backColor=WARNING_BG, borderPadding=2, alignment=1)
CHIP_MULTI = ParagraphStyle("ChipMulti", parent=NORMAL, fontSize=8, leading=10,
                            textColor=INFO_TEXT, backColor=INFO_BG, borderPadding=2, alignment=1)
CHIP_NOMATCH = ParagraphStyle("ChipNoMatch", parent=NORMAL, fontSize=8, leading=10,
                              textColor=DANGER_TEXT, backColor=DANGER_BG, borderPadding=2, alignment=1)


def header(canvas, doc):
    canvas.saveState()
    canvas.setFont(BASE_FONT, 8)
    canvas.setFillColor(GRAPHITE_500)
    canvas.drawString(15 * mm, 10 * mm, f"Prowatech Inspekcje · Brakujące protokoły 2023 · {date.today().isoformat()}")
    canvas.drawRightString(195 * mm, 10 * mm, f"Strona {doc.page}")
    canvas.restoreState()


def status_chip(status: str) -> Paragraph:
    if status == "multi":
        return Paragraph("Plik w GDrive — niejednoznaczny match", CHIP_MULTI)
    if status == "no_match":
        return Paragraph("Plik w GDrive — brak kandydata", CHIP_NOMATCH)
    return Paragraph("Brak pliku w archiwum", CHIP_NOFILE)


def build_section(title: str, rows: list, status: str, columns):
    elements = [Paragraph(f"<b>{title}</b> — {len(rows)} pozycji", H3)]
    chip_table = Table([[status_chip(status)]], colWidths=[60 * mm], rowHeights=[6 * mm])
    chip_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(chip_table)
    elements.append(Spacer(1, 2 * mm))

    table_rows = [columns] + [list(r) for r in rows]
    n_cols = len(columns)
    if n_cols == 4:
        col_widths = [44 * mm, 50 * mm, 48 * mm, 38 * mm]
    elif n_cols == 3:
        col_widths = [60 * mm, 60 * mm, 60 * mm]
    elif n_cols == 5:
        col_widths = [38 * mm, 38 * mm, 36 * mm, 32 * mm, 36 * mm]
    elif n_cols == 2:
        col_widths = [90 * mm, 90 * mm]
    else:
        col_widths = [180 * mm / n_cols] * n_cols

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
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("TEXTCOLOR", (0, 1), (-1, -1), GRAPHITE_900),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRAPHITE_50]),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, GRAPHITE_200),
        ("LINEBELOW", (0, 1), (-1, -2), 0.25, GRAPHITE_200),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAPHITE_200),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 1), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 4 * mm))
    return KeepTogether(elements)


def main():
    output = PROJECT / "Brakujace_protokoly_2023.pdf"
    dryrun = json.loads((PROJECT / "scripts/output/manifest_2023_full_dryrun.json").read_text(encoding="utf-8"))

    # Sekcja A: 81 brakujących placeholderów per klient
    by_client = defaultdict(list)
    for m in dryrun["missing_placeholders"]:
        by_client[m["client_name"]].append((
            m["turbine_code"],
            m["farm_name"],
            m["ew_designation"] or "—",
            m.get("inspection_date") or "—",
        ))

    # Sortowanie klientów po liczbie dziur DESC
    no_file_clients = sorted(by_client.keys(), key=lambda c: -len(by_client[c]))
    no_file_count = sum(len(rows) for rows in by_client.values())

    # Sekcja B: multi-match (jeden wpis per plik z wszystkimi kandydatami)
    multi_rows = []
    for m in dryrun["multi_match"]:
        cands = ", ".join(c["turbine_code"] for c in m["candidates"][:5])
        if len(m["candidates"]) > 5:
            cands += f" + {len(m['candidates']) - 5}"
        multi_rows.append((
            m["filename"][:60],
            cands,
            m["rel_path"].split(os.sep)[0][:40],
        ))

    # Sekcja C: no_ew_match
    nomatch_rows = []
    for e in dryrun["no_ew_match"]:
        nomatch_rows.append((
            e["filename"][:80],
            e["top_folder"][:50],
            e.get("protocol_number") or "—",
        ))

    # Sortowanie no_ew po nazwie folderu (grupowanie wizualne)
    nomatch_rows.sort(key=lambda r: r[1])

    doc = SimpleDocTemplate(
        str(output), pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=18 * mm,
        title="Brakujące protokoły 2023 — Prowatech Inspekcje",
        author="ProWaTech Sp. z o.o.",
    )

    story = [
        Paragraph("Brakujące protokoły kontroli rocznej 2023", H1),
        Paragraph(f"Stan archiwum cyfrowego ProWaTech na dzień {date.today().strftime('%d.%m.%Y')}.", NORMAL),
        Spacer(1, 6 * mm),
    ]

    matched_count = dryrun.get("matched_count", 0)
    total_placeholders = dryrun["placeholders_2023_empty_before"]
    summary_rows = [
        ["Łączna liczba placeholderów 2023 w bazie", str(total_placeholders + 3)],  # +3 bo było 3 z plikiem przed sesją
        ["Pliki PDF znalezione w GDrive 2023", str(dryrun["total_pdf_files_scanned"])],
        ["Pominięte (non-protocol / wrong year)",
         f"{dryrun['non_protocol_skipped'] + dryrun['wrong_year_skipped']}"],
        ["Pliki zmatchowane i wgrane do bazy",
         f"{matched_count} / {total_placeholders}  ({100*matched_count/total_placeholders:.1f} %)"],
        ["Brakujące placeholdery (sekcja A)", f"{no_file_count}"],
        ["Pliki w GDrive — niejednoznaczny match (sekcja B)", f"{len(multi_rows)}"],
        ["Pliki w GDrive — brak kandydata (sekcja C)", f"{len(nomatch_rows)}"],
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
    legend = Table([
        [status_chip("no_file"), Paragraph(
            "Brak pliku PDF w GDrive 2023 dla tej turbiny. Operator albo nie wykonał "
            "kontroli rocznej w 2023, albo trzyma plik poza zasięgiem ProWaTech.", NORMAL)],
        [status_chip("multi"), Paragraph(
            "Plik istnieje w GDrive 2023, ale nazwa pasuje do kilku kandydatów turbin. "
            "Wymaga ręcznej decyzji który plik komu przypisać.", NORMAL)],
        [status_chip("no_match"), Paragraph(
            "Plik w GDrive 2023 ma nazwę protokołu, ale matcher nie znalazł żadnej "
            "pasującej turbiny. Najczęstsze przyczyny: literówki w nazwie (np. "
            "<i>Ciólkowo</i> vs <i>Ciółkowo</i>), niestandardowe nazewnictwo "
            "operatora (np. <i>EW Bławaty</i> w pliku, <i>WTG1</i> w bazie).", NORMAL)],
    ], colWidths=[55 * mm, 125 * mm])
    legend.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(legend)
    story.append(Spacer(1, 6 * mm))

    # Section A
    if no_file_clients:
        story.append(Paragraph(
            f"A. Turbiny bez pliku w archiwum cyfrowym — {no_file_count} turbin u {len(no_file_clients)} klientów",
            H2,
        ))
        story.append(Paragraph(
            "Dla tych turbin nie znaleziono protokołu kontroli rocznej 2023 w GDrive 2023 "
            "(folder <font name='%s'>04 Inspekcje/2023</font>). Możliwe przyczyny: kontrola "
            "nie została wykonana, plik jest u operatora poza zasięgiem ProWaTech, lub "
            "został umieszczony w innym folderze." % BASE_FONT,
            NORMAL,
        ))
        story.append(Spacer(1, 3 * mm))
        for client in no_file_clients:
            rows = by_client[client]
            story.append(build_section(
                client, rows, "no_file",
                ["Turbina", "Farma", "Oznaczenie EW", "Data (z arkusza)"],
            ))

    # Section B
    if multi_rows:
        story.append(PageBreak())
        story.append(Paragraph(
            f"B. Pliki w GDrive — niejednoznaczny match — {len(multi_rows)} plików",
            H2,
        ))
        story.append(Paragraph(
            "Pliki PDF wyglądają jak protokoły roczne 2023, ale nazwa pasuje do kilku turbin "
            "jednocześnie (np. plik <i>EW 2 Solec 27-04-2023</i> może dotyczyć T329-Sumin lub "
            "T323-Solec Kujawski). Wymaga ręcznej weryfikacji i decyzji komu przypisać.",
            NORMAL,
        ))
        story.append(Spacer(1, 3 * mm))
        story.append(build_section(
            "Pliki niejednoznaczne", multi_rows, "multi",
            ["Plik", "Kandydaci", "Folder klienta"],
        ))

    # Section C
    if nomatch_rows:
        story.append(PageBreak())
        story.append(Paragraph(
            f"C. Pliki w GDrive — brak kandydata turbiny — {len(nomatch_rows)} plików",
            H2,
        ))
        story.append(Paragraph(
            "Pliki PDF z nazwy wyglądają jak protokoły 2023, ale matcher nie znalazł żadnej "
            "pasującej turbiny w bazie. Często są to <b>singleton-farms</b> (1 turbina = "
            "1 nazwa farmy w pliku, np. <i>EW Bławaty</i>) lub pliki nieprotokołowe "
            "(zawiadomienia, faktury, dokumenty zbiorcze). Wymaga ręcznej decyzji.",
            NORMAL,
        ))
        story.append(Spacer(1, 3 * mm))
        story.append(build_section(
            "Pliki bez kandydata", nomatch_rows, "no_match",
            ["Plik", "Folder", "Nr proto."],
        ))

    doc.build(story, onFirstPage=header, onLaterPages=header)
    size_kb = os.path.getsize(output) / 1024
    print(f"OK  {output.name}  ({size_kb:.1f} KB)")
    print(f"\nPodsumowanie:")
    print(f"  Brakujące placeholdery (sekcja A):       {no_file_count} u {len(no_file_clients)} klientów")
    print(f"  Pliki niejednoznaczne (sekcja B):        {len(multi_rows)}")
    print(f"  Pliki bez kandydata (sekcja C):          {len(nomatch_rows)}")


if __name__ == "__main__":
    main()
