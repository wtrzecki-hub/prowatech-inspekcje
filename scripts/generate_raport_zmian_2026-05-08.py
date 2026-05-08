"""Konwerter markdown -> PDF dla raportu Tomka.

Prosty mini-parser markdown obslugujacy:
- # / ## / ### naglowki
- paragraphs z **bold** *italic* `code`
- blockquote (>)
- listy bulleted (-) i numbered (1.)
- tabele |col|col|
- hr (---)
- font Roboto dla polskich znakow
"""

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

PROJECT = Path(__file__).resolve().parent.parent
INPUT = PROJECT / "docs" / "reports" / "2026-05-07-08-raport-zmian.md"
OUTPUT = PROJECT / "docs" / "reports" / "2026-05-07-08-raport-zmian.pdf"

# Fonty: Roboto dla polskich znakow
FONT_REG = PROJECT / "src" / "fonts" / "Roboto-Regular.ttf"
FONT_BOLD = PROJECT / "src" / "fonts" / "Roboto-Bold.ttf"
FONT_ITALIC = PROJECT / "src" / "fonts" / "Roboto-Italic.ttf"
FONT_BOLD_ITALIC = PROJECT / "src" / "fonts" / "Roboto-BoldItalic.ttf"

if FONT_REG.exists():
    pdfmetrics.registerFont(TTFont("Roboto", str(FONT_REG)))
    if FONT_BOLD.exists():
        pdfmetrics.registerFont(TTFont("Roboto-Bold", str(FONT_BOLD)))
    if FONT_ITALIC.exists():
        pdfmetrics.registerFont(TTFont("Roboto-Italic", str(FONT_ITALIC)))
    if FONT_BOLD_ITALIC.exists():
        pdfmetrics.registerFont(TTFont("Roboto-BoldItalic", str(FONT_BOLD_ITALIC)))
    # Mapping family
    from reportlab.pdfbase.pdfmetrics import registerFontFamily

    registerFontFamily(
        "Roboto",
        normal="Roboto",
        bold="Roboto-Bold" if FONT_BOLD.exists() else "Roboto",
        italic="Roboto-Italic" if FONT_ITALIC.exists() else "Roboto",
        boldItalic="Roboto-BoldItalic" if FONT_BOLD_ITALIC.exists() else "Roboto",
    )
    BASE = "Roboto"
    BOLD = "Roboto-Bold" if FONT_BOLD.exists() else "Roboto"
else:
    BASE = "Helvetica"
    BOLD = "Helvetica-Bold"

# Kolory ProWaTech
PRIMARY = colors.HexColor("#259648")
PRIMARY_LIGHT = colors.HexColor("#E8F5EC")
GRAPHITE_900 = colors.HexColor("#1F2937")
GRAPHITE_700 = colors.HexColor("#374151")
GRAPHITE_500 = colors.HexColor("#6B7280")
GRAPHITE_200 = colors.HexColor("#E5E7EB")
GRAPHITE_50 = colors.HexColor("#F9FAFB")
INFO_BG = colors.HexColor("#DBEAFE")
INFO_TEXT = colors.HexColor("#1E40AF")

styles = getSampleStyleSheet()

H1 = ParagraphStyle(
    "H1",
    parent=styles["Heading1"],
    fontName=BOLD,
    fontSize=22,
    leading=28,
    textColor=GRAPHITE_900,
    spaceBefore=0,
    spaceAfter=12,
)
H2 = ParagraphStyle(
    "H2",
    parent=styles["Heading2"],
    fontName=BOLD,
    fontSize=15,
    leading=20,
    textColor=PRIMARY,
    spaceBefore=14,
    spaceAfter=8,
)
H3 = ParagraphStyle(
    "H3",
    parent=styles["Heading3"],
    fontName=BOLD,
    fontSize=11,
    leading=15,
    textColor=GRAPHITE_700,
    spaceBefore=8,
    spaceAfter=4,
)
BODY = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontName=BASE,
    fontSize=10,
    leading=14,
    textColor=GRAPHITE_900,
    spaceBefore=2,
    spaceAfter=4,
    alignment=4,  # justify
)
BLOCKQUOTE = ParagraphStyle(
    "Blockquote",
    parent=BODY,
    fontName=BASE,
    fontSize=10,
    leading=14,
    leftIndent=12,
    textColor=GRAPHITE_700,
    spaceBefore=4,
    spaceAfter=8,
    borderColor=PRIMARY,
    borderWidth=0,
)
LIST_ITEM = ParagraphStyle(
    "ListItem",
    parent=BODY,
    leftIndent=14,
    bulletIndent=2,
    spaceBefore=1,
    spaceAfter=2,
)
META = ParagraphStyle(
    "Meta",
    parent=styles["Normal"],
    fontName=BASE,
    fontSize=9,
    leading=12,
    textColor=GRAPHITE_500,
)


def _inline(text: str) -> str:
    """Zamiana inline markdown na reportlab XML."""
    # XML-escape najpierw
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Code inline `xxx` -> <font name=Courier>
    text = re.sub(r"`([^`]+?)`", r'<font name="Courier" color="#6B21A8">\1</font>', text)
    # Bold **xxx**
    text = re.sub(r"\*\*([^*]+?)\*\*", r"<b>\1</b>", text)
    # Italic *xxx* (po bold zeby uniknac konfliktu)
    text = re.sub(r"(?<!\*)\*([^*\n]+?)\*(?!\*)", r"<i>\1</i>", text)
    # Linki [text](url) -> tylko text (PDF nie potrzebuje hyperlinku)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    return text


def _is_table_row(line: str) -> bool:
    return line.startswith("|") and line.endswith("|") and "|" in line[1:-1]


def _is_table_separator(line: str) -> bool:
    if not _is_table_row(line):
        return False
    cells = [c.strip() for c in line.strip("|").split("|")]
    return all(re.match(r"^:?-+:?$", c) for c in cells if c)


def _parse_table_row(line: str) -> list[str]:
    cells = line.strip("|").split("|")
    return [c.strip() for c in cells]


def md_to_story(md_text: str):
    """Zamiana tekstu markdown na liste flowables reportlab."""
    story = []
    lines = md_text.split("\n")
    i = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Pusty wiersz
        if not stripped:
            i += 1
            continue

        # Horizontal rule
        if stripped == "---":
            story.append(Spacer(1, 4))
            story.append(HRFlowable(width="100%", color=GRAPHITE_200, thickness=0.5))
            story.append(Spacer(1, 6))
            i += 1
            continue

        # H1
        if stripped.startswith("# "):
            story.append(Paragraph(_inline(stripped[2:]), H1))
            i += 1
            continue
        # H2
        if stripped.startswith("## "):
            story.append(Paragraph(_inline(stripped[3:]), H2))
            i += 1
            continue
        # H3
        if stripped.startswith("### "):
            story.append(Paragraph(_inline(stripped[4:]), H3))
            i += 1
            continue

        # Blockquote
        if stripped.startswith("> "):
            quote_lines = []
            while i < len(lines) and lines[i].strip().startswith("> "):
                quote_lines.append(lines[i].strip()[2:])
                i += 1
            quote_text = " ".join(quote_lines)
            story.append(Paragraph("<i>" + _inline(quote_text) + "</i>", BLOCKQUOTE))
            continue

        # Tabela
        if _is_table_row(stripped) and i + 1 < len(lines) and _is_table_separator(lines[i + 1].strip()):
            header = _parse_table_row(stripped)
            i += 2  # skip header + separator
            rows = []
            while i < len(lines) and _is_table_row(lines[i].strip()):
                rows.append(_parse_table_row(lines[i].strip()))
                i += 1
            # Build reportlab Table
            data = [[Paragraph("<b>" + _inline(c) + "</b>", BODY) for c in header]]
            for row in rows:
                data.append([Paragraph(_inline(c), BODY) for c in row])
            # Auto-fit columns
            available_width = 170 * mm  # A4 - 2*20mm margins
            col_count = len(header)
            col_widths = [available_width / col_count] * col_count
            tbl = Table(data, colWidths=col_widths, repeatRows=1)
            tbl.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_LIGHT),
                        ("TEXTCOLOR", (0, 0), (-1, 0), GRAPHITE_900),
                        ("BOX", (0, 0), (-1, -1), 0.5, PRIMARY),
                        ("INNERGRID", (0, 0), (-1, -1), 0.25, GRAPHITE_200),
                        ("LEFTPADDING", (0, 0), (-1, -1), 5),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ]
                )
            )
            story.append(Spacer(1, 4))
            story.append(tbl)
            story.append(Spacer(1, 6))
            continue

        # Bullet list
        if stripped.startswith("- "):
            items = []
            while i < len(lines) and lines[i].strip().startswith("- "):
                items.append(lines[i].strip()[2:])
                i += 1
            for item in items:
                story.append(
                    Paragraph(
                        "<font color='#259648'>•</font> " + _inline(item), LIST_ITEM
                    )
                )
            story.append(Spacer(1, 2))
            continue

        # Numbered list
        if re.match(r"^\d+\.\s", stripped):
            items = []
            while i < len(lines) and re.match(r"^\d+\.\s", lines[i].strip()):
                m = re.match(r"^(\d+)\.\s+(.+)$", lines[i].strip())
                if m:
                    items.append((m.group(1), m.group(2)))
                i += 1
            for num, text in items:
                story.append(
                    Paragraph(
                        f"<b>{num}.</b> " + _inline(text), LIST_ITEM
                    )
                )
            story.append(Spacer(1, 2))
            continue

        # Plain paragraph - moze byc multi-line
        para_lines = [stripped]
        i += 1
        while i < len(lines):
            nxt = lines[i].strip()
            if (
                not nxt
                or nxt.startswith(("#", "-", ">", "|", "---"))
                or re.match(r"^\d+\.\s", nxt)
            ):
                break
            para_lines.append(nxt)
            i += 1
        para_text = " ".join(para_lines)
        story.append(Paragraph(_inline(para_text), BODY))

    return story


def _on_page(canvas, doc):
    """Stopka z numerem strony i nazwa raportu."""
    canvas.saveState()
    canvas.setFont(BASE, 8)
    canvas.setFillColor(GRAPHITE_500)
    canvas.drawString(
        20 * mm,
        12 * mm,
        f"Prowatech Inspekcje • Raport dla Artura • 2026-05-06",
    )
    canvas.drawRightString(
        A4[0] - 20 * mm, 12 * mm, f"Strona {doc.page}"
    )
    canvas.restoreState()


def main():
    md_text = INPUT.read_text(encoding="utf-8")
    story = md_to_story(md_text)

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        title="Raport dla Artura — Prowatech Inspekcje 2026-05-06",
        author="Waldek (z asystą Claude)",
    )
    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    size_kb = OUTPUT.stat().st_size / 1024
    print(f"OK  {OUTPUT.name}  ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
