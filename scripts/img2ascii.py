#!/usr/bin/env python3
"""
img2ascii.py

Converts a PNG (e.g. your pixel art mage character) into the ASCII art
block terminal-card.mjs reads from assets/ascii/mage.txt.

Usage:
    pip install pillow
    python scripts/img2ascii.py path/to/mage.png --width 26 > assets/ascii/mage.txt

Then re-run scripts/terminal-card.mjs (or just wait for the daily workflow),
it automatically picks up assets/ascii/mage.txt if present and falls back to
a placeholder block if not.

Character cells are roughly twice as tall as they are wide in a terminal
font, so --width controls output width in characters and the height is
derived from the image's aspect ratio to avoid a squashed result.
"""

import argparse
import sys

try:
    from PIL import Image
except ImportError:
    print("This script needs Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)

# Darkest to lightest. Pick a ramp that reads well at small sizes.
RAMP = "@%#*+=-:. "


def image_to_ascii(path: str, out_width: int) -> str:
    img = Image.open(path).convert("L")  # grayscale
    aspect = img.height / img.width
    # Compensate for character cells being taller than wide (~0.5 ratio).
    out_height = max(1, round(out_width * aspect * 0.5))
    img = img.resize((out_width, out_height))

    lines = []
    for y in range(out_height):
        row = []
        for x in range(out_width):
            lum = img.getpixel((x, y))  # 0 (black) .. 255 (white)
            idx = int((lum / 255) * (len(RAMP) - 1))
            row.append(RAMP[idx])
        lines.append("".join(row))
    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", help="Path to a PNG (transparent background recommended)")
    parser.add_argument("--width", type=int, default=26, help="Output width in characters (default 26)")
    args = parser.parse_args()

    print(image_to_ascii(args.image, args.width))
