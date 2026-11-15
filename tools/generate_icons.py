#!/usr/bin/env python3
"""Generate the Space Explorer PWA PNG icons (no text, offline, deterministic)."""
from __future__ import annotations

import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = Path(__file__).resolve().parent.parent / "icons"
SS = 4  # supersampling factor

CREAM = (240, 247, 255, 255)
CREAM_SHADE = (226, 232, 240, 150)
CYAN = (6, 182, 212, 255)
CYAN_LIGHT = (165, 243, 252, 235)
ORANGE = (249, 115, 22, 255)
STAR = (251, 191, 36, 255)
INK = (11, 18, 32, 255)


def gradient(size: int) -> Image.Image:
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    t = np.clip(xx / (size - 1) * 0.55 + yy / (size - 1) * 0.45, 0.0, 1.0)
    c0 = np.array([11, 18, 32], dtype=np.float32)
    c1 = np.array([22, 35, 63], dtype=np.float32)
    arr = c0 + (c1 - c0) * t[..., None]

    def glow(cx: float, cy: float, radius: float, color: tuple[int, int, int], strength: float) -> None:
        nonlocal arr
        dist = np.sqrt((xx / size - cx) ** 2 + (yy / size - cy) ** 2)
        a = np.clip(1.0 - dist / radius, 0.0, 1.0) ** 2 * strength
        arr = arr * (1.0 - a[..., None]) + np.array(color, dtype=np.float32) * a[..., None]

    glow(0.83, 0.16, 0.62, (6, 182, 212), 0.34)
    glow(0.12, 0.9, 0.55, (249, 115, 22), 0.16)
    glow(0.5, 0.5, 0.7, (22, 35, 63), 0.1)
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, mode="RGB").convert("RGBA")


def star4(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, fill: tuple[int, ...]) -> None:
    inner = r * 0.28
    pts = [
        (cx, cy - r),
        (cx + inner, cy - inner),
        (cx + r, cy),
        (cx + inner, cy + inner),
        (cx, cy + r),
        (cx - inner, cy + inner),
        (cx - r, cy),
        (cx - inner, cy - inner),
    ]
    draw.polygon(pts, fill=fill)


def draw_stars(img: Image.Image, size: int, seed: int, dense: bool = True) -> None:
    draw = ImageDraw.Draw(img)
    rng = random.Random(seed)
    count = 22 if dense else 14
    for _ in range(count):
        x = rng.uniform(0.06, 0.94) * size
        y = rng.uniform(0.06, 0.94) * size
        r = rng.uniform(0.0025, 0.0075) * size
        alpha = rng.randint(90, 225)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(226, 232, 240, alpha))
    star4(draw, 0.76 * size, 0.23 * size, 0.05 * size, STAR)
    star4(draw, 0.2 * size, 0.7 * size, 0.032 * size, (226, 232, 240, 210))


def rocket_layer(size: int) -> Image.Image:
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx = 0.5 * size
    gd.ellipse((cx - 0.07 * size, 0.72 * size, cx + 0.07 * size, 0.9 * size), fill=(251, 191, 36, 130))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=0.025 * size))
    layer.alpha_composite(glow)

    d = ImageDraw.Draw(layer)
    body_w = 0.155 * size

    d.ellipse((cx - 0.19 * size, 0.7 * size, cx + 0.19 * size, 0.79 * size), fill=(6, 182, 212, 40))

    d.polygon(
        [(cx, 0.135 * size), (cx - body_w, 0.38 * size), (cx + body_w, 0.38 * size)],
        fill=CREAM,
    )
    d.ellipse((cx - body_w, 0.3 * size, cx + body_w, 0.745 * size), fill=CREAM)
    d.polygon(
        [(cx, 0.135 * size), (cx - 0.085 * size, 0.32 * size), (cx - 0.02 * size, 0.26 * size)],
        fill=(248, 250, 252, 255),
    )
    d.polygon(
        [(cx - 0.02 * size, 0.26 * size), (cx - 0.085 * size, 0.32 * size), (cx - 0.12 * size, 0.44 * size)],
        fill=CREAM_SHADE,
    )

    d.polygon(
        [(cx - body_w + 0.005 * size, 0.54 * size), (cx - 0.285 * size, 0.69 * size),
         (cx - 0.25 * size, 0.765 * size), (cx - body_w, 0.68 * size)],
        fill=ORANGE,
    )
    d.polygon(
        [(cx + body_w - 0.005 * size, 0.54 * size), (cx + 0.285 * size, 0.69 * size),
         (cx + 0.25 * size, 0.765 * size), (cx + body_w, 0.68 * size)],
        fill=ORANGE,
    )
    d.polygon(
        [(cx - body_w, 0.66 * size), (cx - 0.25 * size, 0.765 * size), (cx - body_w, 0.7 * size)],
        fill=(194, 65, 12, 255),
    )
    d.polygon(
        [(cx + body_w, 0.66 * size), (cx + 0.25 * size, 0.765 * size), (cx + body_w, 0.7 * size)],
        fill=(194, 65, 12, 255),
    )

    d.polygon(
        [(cx - 0.058 * size, 0.725 * size), (cx, 0.885 * size), (cx + 0.058 * size, 0.725 * size)],
        fill=STAR,
    )
    d.polygon(
        [(cx - 0.03 * size, 0.73 * size), (cx, 0.835 * size), (cx + 0.03 * size, 0.73 * size)],
        fill=ORANGE,
    )

    win_r = 0.062 * size
    d.ellipse((cx - win_r, 0.355 * size - win_r, cx + win_r, 0.355 * size + win_r), fill=INK)
    d.ellipse(
        (cx - win_r + 0.012 * size, 0.355 * size - win_r + 0.012 * size,
         cx + win_r - 0.012 * size, 0.355 * size + win_r - 0.012 * size),
        fill=CYAN,
    )
    d.ellipse(
        (cx - 0.026 * size, 0.355 * size - 0.03 * size,
         cx + 0.002 * size, 0.355 * size - 0.002 * size),
        fill=CYAN_LIGHT,
    )

    return layer.rotate(-14, resample=Image.Resampling.BICUBIC, center=(cx, cx))


def make_icon(size: int, *, rounded: bool, seed: int) -> Image.Image:
    s = size * SS
    img = gradient(s)
    draw_stars(img, s, seed)
    img.alpha_composite(rocket_layer(s))

    if rounded:
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=int(0.22 * s), fill=255)
        img.putalpha(mask)

    return img.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    make_icon(192, rounded=True, seed=1043).save(OUT_DIR / "icon-192.png", "PNG")
    make_icon(512, rounded=True, seed=1043).save(OUT_DIR / "icon-512.png", "PNG")
    make_icon(512, rounded=False, seed=1044).save(OUT_DIR / "maskable-512.png", "PNG")

    for name in ("icon-192.png", "icon-512.png", "maskable-512.png"):
        with Image.open(OUT_DIR / name) as im:
            print(f"{name}: {im.size[0]}x{im.size[1]} {im.mode}")


if __name__ == "__main__":
    main()
