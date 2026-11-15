#!/usr/bin/env python3
"""Bundle the web prototype into a single offline HTML file for the M1 deliverable."""
from __future__ import annotations

import argparse
import html
import re
from pathlib import Path


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def build(web_dir: Path, out_path: Path) -> None:
    index = read(web_dir / "index.html")
    css = read(web_dir / "assets/css/app.css")
    data_js = read(web_dir / "assets/js/data.js")
    app_js = read(web_dir / "assets/js/app.js")

    index = re.sub(
        r'\s*<link rel="manifest"[^>]*>',
        "",
        index,
    )
    index = re.sub(
        r'\s*<link rel="icon"[^>]*>',
        '\n  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E%3Crect width=\'32\' height=\'32\' rx=\'8\' fill=\'%230B1220\'/%3E%3Cpath d=\'M16 6l3 7 7 3-7 3-3 7-3-7-7-3 7-3z\' fill=\'%23FBBF24\'/%3E%3C/svg%3E">',
        index,
    )
    index = index.replace(
        '  <link rel="stylesheet" href="assets/css/app.css">',
        "  <style>\n" + css + "\n  </style>",
    )
    index = index.replace(
        '  <script src="assets/js/data.js" defer></script>\n  <script src="assets/js/app.js" defer></script>',
        "  <script>\n"
        + data_js.replace("</script", "<\\/script")
        + "\n  </script>\n  <script>\n"
        + app_js.replace("</script", "<\\/script")
        + "\n  </script>",
    )
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
        default=Path(__file__).resolve().parents[2] / "Deliverables" / "UI_Design_System_Prototype_v0.1.html",
    )
    args = parser.parse_args()
    build(args.web, args.out)
    size_kb = args.out.stat().st_size / 1024
    print(f"Wrote {args.out} ({size_kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
