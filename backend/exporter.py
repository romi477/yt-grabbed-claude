import json
from datetime import datetime, timezone
from pathlib import Path

from fpdf import FPDF

TRANSCRIPTS_DIR = Path("transcripts")


def _stem(title: str) -> str:
    """Make a safe filename stem from a title."""
    safe = "".join(c if c.isalnum() or c in " -_()" else "_" for c in title)
    return safe.strip()[:80] or "transcript"


def export_txt(text: str, title: str) -> Path:
    """Save transcript as plain text file."""
    TRANSCRIPTS_DIR.mkdir(exist_ok=True)
    path = TRANSCRIPTS_DIR / f"{_stem(title)}.txt"
    path.write_text(text, encoding="utf-8")
    return path


def export_json(text: str, title: str, url: str, model: str) -> Path:
    """Save transcript as JSON with metadata."""
    TRANSCRIPTS_DIR.mkdir(exist_ok=True)
    path = TRANSCRIPTS_DIR / f"{_stem(title)}.json"
    payload = {
        "title": title,
        "url": url,
        "model": model,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "transcript": text,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


DEJAVU_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
DEJAVU_FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def export_pdf(text: str, title: str) -> Path:
    """Save transcript as PDF with title heading and wrapped body text.
    Uses DejaVu Sans for full Unicode (incl. Cyrillic) support.
    """
    TRANSCRIPTS_DIR.mkdir(exist_ok=True)
    path = TRANSCRIPTS_DIR / f"{_stem(title)}.pdf"

    pdf = FPDF()
    pdf.set_margins(20, 20, 20)
    pdf.add_page()

    # Register DejaVu fonts for Unicode support
    pdf.add_font("DejaVu", style="", fname=DEJAVU_FONT)
    pdf.add_font("DejaVu", style="B", fname=DEJAVU_FONT_BOLD)

    # Title
    pdf.set_font("DejaVu", style="B", size=16)
    pdf.multi_cell(0, 10, title, align="L")
    pdf.ln(4)

    # Divider
    pdf.set_draw_color(200, 200, 200)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(6)

    # Body
    pdf.set_font("DejaVu", size=11)
    pdf.multi_cell(0, 7, text, align="L")

    pdf.output(str(path))
    return path
