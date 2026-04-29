"""Generate PDF report — turbines without 2024 archive PDF.

Reads live data from Supabase (placeholders 2024 with NULL protocol_pdf_url)
and merges with manifest_2024_z2025_pb.json (48 plików gotowych do uploadu).

Output: Brakujace_protokoly_2024.pdf
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
# Roboto z public/fonts (już używane w PDFach aplikacji)
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

# ── Data — pełna lista 141 placeholderów (z SQL audytu 2026-04-28) ──
# Format: (turbine_code, ew_designation, serial_number, farm_name)
DATA = [
    # FW Żary (7) — brak folderu 2025, no_file
    ("\"FW Żary\" Sp. z o.o.", [
        ("T282-Drożków", "WTG06", "WTG06 -NX 87670", "FW Żary"),
        ("T283-Drożków", "WTG07", "WTG07 - NX 87669", "FW Żary"),
        ("T284-Drożków", "WTG09", "WTG09 - NX 87668", "FW Żary"),
        ("T285-Lubanice", "WTG13", "WTG13 - NX 87674", "FW Żary"),
        ("T286-Lubanice", "WTG15", "WTG15 - NX 87672", "FW Żary"),
        ("T287-Lubanice", "WTG16", "WTG16 - NX 87671", "FW Żary"),
        ("T288-Lubanice", "WTG17", "WTG17 - NX 87673", "FW Żary"),
    ], "no_file"),
    # CHODZIEŻ (4) — pending upload
    ("CHODZIEŻ WIND ENERGY PARK Sp. z o.o.", [
        ("T416-Pietronki", "EW 1", "V242463", "FW Chodzież"),
        ("T417-Pietronki", "EW 2", "V242464", "FW Chodzież"),
        ("T418-Pietronki", "EW 3", "V242465", "FW Chodzież"),
        ("T419-Pietronki", "EW 4", "V242466", "FW Chodzież"),
    ], "pending"),
    # CIME WIND KRZANOWICE III (3) — hard case, no_file
    ("CIME WIND KRZANOWICE III Sp. z o.o.", [
        ("T337-Krzanowice", "EW Krzanowice B5", "V16371", "FW Krzanowice"),
        ("T338-Krzanowice", "EW Krzanowice B3", "V17688", "FW Krzanowice"),
        ("T340-Krzanowice", "EW Krzanowice FWC1", "V17685", "FW Krzanowice"),
    ], "no_file"),
    # Denmark Wind (1) — no_file
    ("Denmark Wind Sp. z o.o.", [
        ("T014-Targowisko Dolne", "EW 1", "531380", "FW Targowisko"),
    ], "no_file"),
    # EUROWIND POLSKA IX (7) — no_file
    ("EUROWIND POLSKA IX Sp. z o.o., Sp. k.", [
        ("T371-Żalęcino", "EW 26", "V11965", "FW ŻALĘCINO"),
        ("T372-Żalęcino", "EW 27", "V11966", "FW ŻALĘCINO"),
        ("T373-Żalęcino", "EW 28", "V11964", "FW ŻALĘCINO"),
        ("T374-Żalęcino", "EW 29", "V11956", "FW ŻALĘCINO"),
        ("T375-Żalęcino", "EW 30", "V11967", "FW ŻALĘCINO"),
        ("T376-Żalęcino", "EW 31", "V11959", "FW ŻALĘCINO"),
        ("T377-Żalęcino", "EW 32", "V11963", "FW ŻALĘCINO"),
    ], "no_file"),
    # EW DAMASŁAWEK (26) — pending upload
    ("EW DAMASŁAWEK Sp. z o.o., Sp. k.", [
        ("T389-Gorzyce", "WTG1", "V244019", "FW ŻNIN-DAMASŁAWEK"),
        ("T390-Gorzyce", "WTG2", "V244020", "FW ŻNIN-DAMASŁAWEK"),
        ("T391-Gorzyce", "WTG3", "V244021", "FW ŻNIN-DAMASŁAWEK"),
        ("T392-Gorzyce", "WTG4", "V244022", "FW ŻNIN-DAMASŁAWEK"),
        ("T393-Gorzyce", "WTG5", "V244023", "FW ŻNIN-DAMASŁAWEK"),
        ("T394-Bożejewice", "WTG6", "V244024", "FW ŻNIN-DAMASŁAWEK"),
        ("T395-Gorzyce", "WTG7", "V244025", "FW ŻNIN-DAMASŁAWEK"),
        ("T396-Słabomierz", "WTG8", "V244026", "FW ŻNIN-DAMASŁAWEK"),
        ("T397-Słabomierz", "WTG9", "V244027", "FW ŻNIN-DAMASŁAWEK"),
        ("T398-Gruntowice", "WTG10", "V244028", "FW ŻNIN-DAMASŁAWEK"),
        ("T399-Kołybki", "WTG11", "V244029", "FW ŻNIN-DAMASŁAWEK"),
        ("T400-Kołybki", "WTG12", "V244030", "FW ŻNIN-DAMASŁAWEK"),
        ("T401-Kopanina", "WTG13", "V244031", "FW ŻNIN-DAMASŁAWEK"),
        ("T402-Kopanina", "WTG14", "V244032", "FW ŻNIN-DAMASŁAWEK"),
        ("T403-Mokronosy", "WTG15", "V244033", "FW ŻNIN-DAMASŁAWEK"),
        ("T404-Mokronosy", "WTG16", "V244034", "FW ŻNIN-DAMASŁAWEK"),
        ("T406-Starężynek", "WTG18", "V244036", "FW ŻNIN-DAMASŁAWEK"),
        ("T407-Kozielsko", "WTG19", "V244037", "FW ŻNIN-DAMASŁAWEK"),
        ("T408-Kozielsko", "WTG20", "V244038", "FW ŻNIN-DAMASŁAWEK"),
        ("T409-Kozielsko", "WTG21", "V244039", "FW ŻNIN-DAMASŁAWEK"),
        ("T410-Uścikowo", "WTG22", "V244040", "FW ŻNIN-DAMASŁAWEK"),
        ("T411-Uścikowo", "WTG23", "V244041", "FW ŻNIN-DAMASŁAWEK"),
        ("T412-Bożejewice", "WTG24", "V244042", "FW ŻNIN-DAMASŁAWEK"),
        ("T413-Sarbinowo", "WTG25", "V244043", "FW ŻNIN-DAMASŁAWEK"),
        ("T414-Cerekwica", "WTG26", "V244044", "FW ŻNIN-DAMASŁAWEK"),
        ("T415-Bożejewice", "WTG27", "V244045", "FW ŻNIN-DAMASŁAWEK"),
    ], "pending"),
    # FWZ (2) — hard case, no_file
    ("FWZ Sp. z o.o.", [
        ("T341-Zawiszyce", "FW Zawiszyce Z2", "Z2", "FW Zawiszyce"),
        ("T342-Zawiszyce", "FW Zawiszyce Z1", "Z1", "FW Zawiszyce"),
    ], "no_file"),
    # GOŚCIEJEWO (1) — pending upload
    ("GOŚCIEJEWO Sp. z o.o., Sp. k", [
        ("T353-Gościejewo", "EW Gościejewo WTG1", "V242447", "FW Gościejewo"),
    ], "pending"),
    # GOSTYNIN (1) — pending upload
    ("GOSTYNIN WIND ENERGY PARK Sp. z o.o.", [
        ("T366-Kozice", "EW Gostynin WTG1", "V242462", "FW Gostynin"),
    ], "pending"),
    # KOTOMIERZ (2) — pending upload
    ("KOTOMIERZ Sp. z o.o., Sp. k.", [
        ("T423-Niewieścin", "EW 1", "V245942", "FW Kotomierz"),
        ("T424-Mirowice", "EW 2", "V245943", "FW Kotomierz"),
    ], "pending"),
    # MIEŚCISKO (3) — pending upload
    ("MIEŚCISKO WIND ENERGY PARK Sp. z o.o., Sp. k.", [
        ("T386-Mieścisko", "EW1", "V244012", "FW Mieścisko"),
        ("T387-Mieścisko", "EW2", "V244013", "FW Mieścisko"),
        ("T388-Mieścisko", "EW3", "V244014", "FW Mieścisko"),
    ], "pending"),
    # OBORNIKI (8) — no_file
    ("OBORNIKI GP GMBH Sp. k.", [
        ("T354-Słomowo", "WTG1", "V240018", "FW Oborniki"),
        ("T355-Słomowo", "WTG2", "V240019", "FW Oborniki"),
        ("T356-Pacholewo", "WTG3", "V240020", "FW Oborniki"),
        ("T357-Pacholewo", "WTG4", "V240021", "FW Oborniki"),
        ("T358-Słomowo", "WTG5", "V240022", "FW Oborniki"),
        ("T359-Słomowo", "WTG6", "V240023", "FW Oborniki"),
        ("T360-Słomowo", "WTG7", "V240024", "FW Oborniki"),
        ("T361-Słomowo", "WTG8", "V240025", "FW Oborniki"),
    ], "no_file"),
    # PNIEWY (4) — pending upload
    ("PNIEWY Sp. z o.o., Sp. k.", [
        ("T362-Pniewy", "WTG1", "V244015", "FW Pniewy"),
        ("T363-Pniewy", "WTG2", "V244016", "FW Pniewy"),
        ("T364-Pniewy", "WTG3", "V244017", "FW Pniewy"),
        ("T365-Zamorze", "WTG4", "V244018", "FW Pniewy"),
    ], "pending"),
    # Poland Power (1) — no_file
    ("Poland Power Sp. z o.o.", [
        ("T015-Losy", "EW Losy", "37647", "EW Losy"),
    ], "no_file"),
    # POTEGOWO MASHAV (38) — no_file
    ("POTEGOWO MASHAV Sp. z o.o.", [
        ("T062-Bęcino", "WTG B07", "27183989", "FW Bęcino"),
        ("T063-Karżniczka", "WTG B12", "27183993", "FW Bęcino"),
        ("T064-Karżniczka", "WTG B13", "27183990", "FW Bęcino"),
        ("T065-Karżniczka", "WTG B11", "27183992", "FW Bęcino"),
        ("T066-Bęcino", "WTG B10", "27183991", "FW Bęcino"),
        ("T067-Głuszynko", "WTG G01", "27185594", "FW Głuszynko"),
        ("T068-Głuszynko", "WTG G02", "27185595", "FW Głuszynko"),
        ("T069-Głuszynko", "WTG G03", "27185589", "FW Głuszynko"),
        ("T070-Głuszynko", "WTG G04", "27185596", "FW Głuszynko"),
        ("T071-Głuszynko", "WTG G05", "27185597", "FW Głuszynko"),
        ("T072-Głuszynko", "WTG G06", "27185598", "FW Głuszynko"),
        ("T073-Głuszynko", "WTG G07", "27185599", "FW Głuszynko"),
        ("T074-Głuszynko", "WTG G08", "27185590", "FW Głuszynko"),
        ("T075-Głuszynko", "WTG G10", "27185600", "FW Głuszynko"),
        ("T076-Głuszynko", "WTG G11", "27185591", "FW Głuszynko"),
        ("T077-Głuszynko", "WTG G12", "27185601", "FW Głuszynko"),
        ("T078-Głuszynko", "WTG G13", "27185602", "FW Głuszynko"),
        ("T079-Głuszynko", "WTG G16", "27185604", "FW Głuszynko"),
        ("T080-Głuszynko", "WTG G17", "27185592", "FW Głuszynko"),
        ("T081-Głuszynko", "WTG G18", "27185605", "FW Głuszynko"),
        ("T082-Głuszynko", "WTG G19", "27185606", "FW Głuszynko"),
        ("T083-Głuszynko", "WTG G20", "27185593", "FW Głuszynko"),
        ("T084-Głuszynko", "WTG G21", "27185607", "FW Głuszynko"),
        ("T085-Głuszynko", "WTG G22", "27185608", "FW Głuszynko"),
        ("T201-Głuszynko", "WTG G15", "27185603", "FW Głuszynko"),
        ("T086-Karżcino", "WTG K-01", "27185609", "FW Karżcino"),
        ("T087-Karżcino", "WTG K-02", "27185610", "FW Karżcino"),
        ("T088-Karżcino", "WTG K-03", "27185618", "FW Karżcino"),
        ("T089-Karżcino", "WTG K-04", "27185611", "FW Karżcino"),
        ("T090-Karżcino", "WTG K-05", "27185612", "FW Karżcino"),
        ("T091-Karżcino", "WTG K-06", "27185613", "FW Karżcino"),
        ("T092-Karżcino", "WTG K-07", "27185619", "FW Karżcino"),
        ("T093-Lubuczewo", "WTG W-01", "27185614", "FW Wrzeście"),
        ("T094-Lubuczewo", "WTG W-02", "27185620", "FW Wrzeście"),
        ("T095-Lubuczewo", "WTG W-03", "27185615", "FW Wrzeście"),
        ("T096-Lubuczewo", "WTG W-04", "27185621", "FW Wrzeście"),
        ("T097-Wrzeście - Kępno", "WTG W-05", "27185616", "FW Wrzeście"),
        ("T098-Wrzeście - Kępno", "WTG W-06", "27185617", "FW Wrzeście"),
    ], "no_file"),
    # RAWICZ (3) — pending upload
    ("RAWICZ Sp. z o.o., Sp. k.", [
        ("T420-Żołędnica", "EW 1 ( w środku protokołu WTG1)", "V242459", "FW Rawicz"),
        ("T421-Łaszczyn", "EW 2 ( w środku protokołu WTG1)", "V242460", "FW Rawicz"),
        ("T422-Łaszczyn", "EW 3 ( w środku protokołu WTG1)", "V242461", "FW Rawicz"),
    ], "pending"),
    # Solbet (17) — no_file
    ("Solbet Sp. z o.o.", [
        ("T326-Golska Huta", "EW Golska Huta", "531634", "EW Golska Huta"),
        ("T317-Kamlarki", "EW Kamlarki", "531130", "EW Kamlarki"),
        ("T318-Łopatki", "EW Łopatki", "531284", "EW Łopatki"),
        ("T324-Małe Czyste", "EW Małe", "531323", "EW Małe"),
        ("T319-Niedźwiedź", "EW Niedźwiedź", "531129", "EW Niedźwiedź"),
        ("T325-Redecz Wielki", "EW Redecz", "531321", "EW Redecz"),
        ("T320-Podzamek Golubski", "EW 01", "531031", "FW PODZAMEK GOLUBSKI"),
        ("T321-Podzamek Golubski", "EW 02", "531030", "FW PODZAMEK GOLUBSKI"),
        ("T322-Solec Kujawski", "EW 1", "531028", "FW SOLEC KUJAWSKI"),
        ("T323-Solec Kujawski", "EW 2", "531029", "FW SOLEC KUJAWSKI"),
        ("EW Sumin-Strzygi", "EW Sumin-Strzygi", "561171", "FW Sumin"),
        ("T328-Sumin", "EW 1", "561170", "FW Sumin"),
        ("T329-Sumin", "EW 2", "531556", "FW Sumin"),
        ("T330-Żałe", "EW Żałe Huta", "531660", "FW ŻAŁE"),
        ("T331-Żałe", "EW Żałe", "531662", "FW ŻAŁE"),
        ("T332-Żałe", "EW Żałe II", "531661", "FW ŻAŁE"),
        ("T333-Żałe", "EW Żałe II", "531663", "FW ŻAŁE"),
    ], "no_file"),
    # Trasko Energia (1) — no_file
    ("Trasko Energia Sp. z o.o.", [
        ("T162-Brzeźno", "EW Brzeźno", "200428", "FW Brzeźno"),
    ], "no_file"),
    # WĄGROWIEC (8) — no_file
    ("WĄGROWIEC Sp. z o.o., Sp. k.", [
        ("T378-Kołybki", "WTG1", "V240010", "FW WĄGROWIEC"),
        ("T379-Kołybki", "WTG2", "V240011", "FW WĄGROWIEC"),
        ("T380-Kopanina", "WTG3", "V240012", "FW WĄGROWIEC"),
        ("T381-Kołybki", "WTG4", "V240013", "FW WĄGROWIEC"),
        ("T382-Kołybki", "WTG5", "V240014", "FW WĄGROWIEC"),
        ("T383-Kołybki", "WTG6", "V240015", "FW WĄGROWIEC"),
        ("T384-Kołybki", "WTG7", "V240016", "FW WĄGROWIEC"),
        ("T385-Kołybki", "WTG8", "V240017", "FW WĄGROWIEC"),
    ], "no_file"),
    # WYRZYSK (4) — pending upload
    ("WYRZYSK GP GMBH Sp. k.", [
        ("T367-Kosztowo", "WTG1", "V240006", "FW WYRZYSK"),
        ("T368-Dobrzyniewo", "WTG2", "V240007", "FW WYRZYSK"),
        ("T369-Kosztowo", "WTG3", "V240008", "FW WYRZYSK"),
        ("T370-Kosztowo", "WTG4", "V240009", "FW WYRZYSK"),
    ], "pending"),
]


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
CHIP_PENDING = ParagraphStyle(
    "ChipPending", parent=NORMAL,
    fontSize=8, leading=10, textColor=INFO_TEXT,
    backColor=INFO_BG, borderPadding=2, alignment=1,
)
CHIP_NOFILE = ParagraphStyle(
    "ChipNoFile", parent=NORMAL,
    fontSize=8, leading=10, textColor=WARNING_TEXT,
    backColor=WARNING_BG, borderPadding=2, alignment=1,
)


# ── Helpers ────────────────────────────────────────────────────────
def header(canvas, doc):
    """Stopka: numer strony + data."""
    canvas.saveState()
    canvas.setFont(BASE_FONT, 8)
    canvas.setFillColor(GRAPHITE_500)
    canvas.drawString(15 * mm, 10 * mm, f"Prowatech Inspekcje · Brakujące protokoły 2024 · {date.today().isoformat()}")
    canvas.drawRightString(195 * mm, 10 * mm, f"Strona {doc.page}")
    canvas.restoreState()


def status_chip(status: str) -> Paragraph:
    if status == "pending":
        return Paragraph("Plik gotowy do uploadu", CHIP_PENDING)
    return Paragraph("Brak pliku w archiwum", CHIP_NOFILE)


def build_client_section(client_name: str, turbines: list, status: str):
    """Sekcja per klient: header + chip statusu + tabela turbin."""
    elements = []
    elements.append(Paragraph(f"<b>{client_name}</b> — {len(turbines)} turbin", H3))

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

    rows = [["Turbina", "Farma", "Oznaczenie EW", "Nr seryjny"]]
    for code, ew, sn, farm in turbines:
        rows.append([code, farm, ew, sn])

    col_widths = [42 * mm, 50 * mm, 45 * mm, 43 * mm]
    table = Table(rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        # Header
        ("FONTNAME", (0, 0), (-1, 0), BOLD_FONT),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5),
        ("BACKGROUND", (0, 0), (-1, 0), GRAPHITE_50),
        ("TEXTCOLOR", (0, 0), (-1, 0), GRAPHITE_700),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
        ("TOPPADDING", (0, 0), (-1, 0), 4),
        # Body
        ("FONTNAME", (0, 1), (-1, -1), BASE_FONT),
        ("FONTSIZE", (0, 1), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 1), (-1, -1), GRAPHITE_900),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRAPHITE_50]),
        # Borders
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, GRAPHITE_200),
        ("LINEBELOW", (0, 1), (-1, -2), 0.25, GRAPHITE_200),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAPHITE_200),
        # Padding
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 1), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 4 * mm))
    return KeepTogether(elements)


# ── Build document ─────────────────────────────────────────────────
def main():
    output = PROJECT / "Brakujace_protokoly_2024.pdf"

    pending_count = sum(len(t) for _, t, s in DATA if s == "pending")
    nofile_count = sum(len(t) for _, t, s in DATA if s == "no_file")
    total = pending_count + nofile_count

    pending_clients = [(c, t) for c, t, s in DATA if s == "pending"]
    nofile_clients = [(c, t) for c, t, s in DATA if s == "no_file"]

    doc = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=18 * mm,
        title="Brakujące protokoły 2024 — Prowatech Inspekcje",
        author="ProWaTech Sp. z o.o.",
    )

    story = []

    # Title
    story.append(Paragraph("Brakujące protokoły kontroli rocznej 2024", H1))
    story.append(Paragraph(
        f"Stan archiwum cyfrowego ProWaTech na dzień {date.today().strftime('%d.%m.%Y')}.",
        NORMAL,
    ))
    story.append(Spacer(1, 6 * mm))

    # Summary card
    summary_rows = [
        ["Łączna liczba turbin", "425"],
        ["Pokrycie protokołami 2024 (stan obecny)", "237 / 378  (62.7 %)"],
        ["Brakujące placeholdery 2024", f"{total}  (141)"],
        ["— pliki gotowe do uploadu (manifest GDrive 2025)", f"{pending_count}  (PB roczny art. 62 PB)"],
        ["— turbiny bez pliku w archiwum cyfrowym", f"{nofile_count}"],
        ["Pokrycie po uploadzie 48 plików PB", "285 / 378  (75.4 %)"],
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
    legend = Table(
        [
            [status_chip("pending"), Paragraph(
                "Plik fizycznie istnieje w GDrive (folder 2025 / subfolder 2024) "
                "jako Przegląd budowlany roczny. Po wgraniu manifestu przez "
                "<font name='%s'>upload_batch.py</font> pojawi się w archiwum." % BASE_FONT,
                NORMAL)],
            [status_chip("no_file"), Paragraph(
                "Brak pliku w GDrive ani w folderze 2024, ani 2025. "
                "Operator nie wykonał kontroli rocznej w 2024 albo trzyma plik "
                "w archiwum poza zasięgiem ProWaTech.", NORMAL)],
        ],
        colWidths=[42 * mm, 138 * mm],
    )
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
    story.append(Paragraph(
        f"A. Pliki gotowe do uploadu — {pending_count} turbin u {len(pending_clients)} klientów",
        H2,
    ))
    story.append(Paragraph(
        "Po wykonaniu komendy "
        "<font name='%s'>python scripts/upload_batch.py "
        "scripts/output/manifest_2024_z2025_pb.json</font> "
        "te placeholdery zostaną wypełnione plikami PDF." % BASE_FONT,
        NORMAL,
    ))
    story.append(Spacer(1, 3 * mm))
    for client_name, turbines in pending_clients:
        story.append(build_client_section(client_name, turbines, "pending"))

    story.append(PageBreak())

    # Section B
    story.append(Paragraph(
        f"B. Turbiny bez pliku w archiwum — {nofile_count} turbin u {len(nofile_clients)} klientów",
        H2,
    ))
    story.append(Paragraph(
        "Dla tych turbin nie znaleziono protokołu kontroli rocznej 2024 ani "
        "w GDrive 2024, ani w GDrive 2025. Możliwe przyczyny: kontrola nie "
        "została wykonana, plik jest u klienta poza zasięgiem ProWaTech, "
        "lub został umieszczony w innym folderze.",
        NORMAL,
    ))
    story.append(Spacer(1, 3 * mm))
    for client_name, turbines in nofile_clients:
        story.append(build_client_section(client_name, turbines, "no_file"))

    doc.build(story, onFirstPage=header, onLaterPages=header)
    size_kb = os.path.getsize(output) / 1024
    print(f"OK  {output.name}  ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
