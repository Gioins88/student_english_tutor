#!/usr/bin/env python3
"""Bundle the web prototype into a single offline HTML file for the M4 deliverable.

All local CSS/JS is inlined in document order. PDF.js stays external: browser-side
PDF import requires the hosted app (it is a network/Gemini feature anyway).
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

SKIP_INLINE = ("assets/vendor/pdfjs/",)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def build(web_dir: Path, out_path: Path) -> None:
    index = read(web_dir / "index.html")

    index = re.sub(r'\s*<link rel="manifest"[^>]*>', "", index)
    index = re.sub(
        r'\s*<link rel="icon"[^>]*>',
        '\n  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E%3Crect width=\'32\' height=\'32\' rx=\'8\' fill=\'%230B1220\'/%3E%3Cpath d=\'M16 6l3 7 7 3-7 3-3 7-3-7-7-3 7-3z\' fill=\'%23FBBF24\'/%3E%3C/svg%3E">',
        index,
    )

    def inline_css(match: re.Match[str]) -> str:
        href = match.group(1)
        if href.startswith("assets/") and not href.startswith(SKIP_INLINE):
            css = read(web_dir / href)
            return "<style>\n" + css + "\n  </style>"
        return match.group(0)

    index = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, index)

    def inline_js(match: re.Match[str]) -> str:
        src = match.group(1)
        if src.startswith("assets/") and not src.startswith(SKIP_INLINE):
            js = read(web_dir / src).replace("</script", "<\\/script")
            return "<script>\n" + js + "\n  </script>"
        return match.group(0)

    index = re.sub(r'<script src="([^"]+)" defer></script>', inline_js, index)
    index = index.replace(
        "<head>",
        "<head>\n  <!-- Single-file snapshot generated from web/ by tools/build_singlefile.py -->",
        1,
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(index, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "Deliverables" / "Student_English_Tutor_App_v1.0.html",
    )
    args = parser.parse_args()
    build(args.web, args.out)
    size_kb = args.out.stat().st_size / 1024
    print(f"Wrote {args.out} ({size_kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
