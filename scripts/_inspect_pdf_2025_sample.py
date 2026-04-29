"""Inspect layout of a 2025 protocol PDF: list images on page 1 with bbox + size."""
import sys
import fitz

def inspect(path: str) -> None:
    doc = fitz.open(path)
    print(f"Pages: {doc.page_count}")
    for pno in range(min(2, doc.page_count)):
        page = doc.load_page(pno)
        rect = page.rect
        print(f"\n=== Page {pno + 1} ({rect.width:.0f} x {rect.height:.0f} pt) ===")
        infos = page.get_image_info(xrefs=True)
        print(f"Images on page: {len(infos)}")
        for i, info in enumerate(infos):
            bbox = info.get("bbox")
            xref = info.get("xref")
            w = info.get("width")
            h = info.get("height")
            try:
                img = doc.extract_image(xref) if xref else None
                ext = img.get("ext") if img else "?"
                size_kb = len(img["image"]) / 1024 if img else 0
            except Exception as e:
                ext = f"err:{e}"
                size_kb = 0
            orient = "portrait" if h > w else "landscape" if w > h else "square"
            print(f"  [{i}] xref={xref} {w}x{h} ({orient}) ext={ext} size={size_kb:.1f}KB")
            if bbox:
                print(f"      bbox=({bbox[0]:.0f}, {bbox[1]:.0f}, {bbox[2]:.0f}, {bbox[3]:.0f}) "
                      f"display={bbox[2]-bbox[0]:.0f}x{bbox[3]-bbox[1]:.0f}pt")

if __name__ == "__main__":
    inspect(sys.argv[1])
