"""Hand-drawn 32x32 pixel-art bust of Shatha, written as an animated SVG
(blinking eyes, twinkling stars) plus a static PNG.

Usage: python sprite_me.py out/pixel-me     -> out/pixel-me.svg, out/pixel-me.png
"""
import random
import sys

from PIL import Image

PAL = {
    "K": "#1a1420",  # outline
    "H": "#25222b",  # hijab
    "h": "#423d4d",  # hijab highlight
    "S": "#f1b892",  # skin
    "s": "#d99470",  # skin shadow
    "C": "#ee9a8a",  # blush
    "B": "#4a3127",  # brows
    "L": "#2a1d1c",  # lash line
    "E": "#f7f4ef",  # eye white
    "I": "#6f8a80",  # grey-green iris
    "M": "#c4606a",  # lips
    "W": "#f6f6f3",  # blazer
    "w": "#c9cfd9",  # blazer shadow
    "T": "#e9e3d8",  # blouse
    "G": "#e7b43c",  # gold necklace
}

SPRITE = [
    "................................",
    "................................",
    "............KKKKKKKK............",
    "..........KKHHHHHHHHKK..........",
    ".........KHHHhhhHHHHHHK.........",
    "........KHHhhhHHHHHHHHHK........",
    "........KHHhHHHHHHHHHHHK........",
    ".......KHHHHHHHHHHHHHHHHK.......",
    ".......KHHHSSSSSSSSSSHHHK.......",
    ".......KHHSBBBSSSSBBBSHHK.......",
    ".......KHHSSLLLSSLLLSSHHK.......",
    ".......KHHSSEIESSEIESSHHK.......",
    ".......KHHSCCSSSsSSCCSHHK.......",
    ".......KHHSSSSSSSSSSSSHHK.......",
    ".......KHHsSSSSMMSSSSsHHK.......",
    ".......KHHHsSSSSSSSSsHHHK.......",
    ".......KHHHHsSSSSSSsHHHHK.......",
    "........KHHHHssssssHHHHK........",
    "........KHhHHHHHHHHHHhHK........",
    ".......KHhHHHHHHHHHHHHhHK.......",
    ".....KWWKHhHHHHHHHHHHhHKWWK.....",
    "....KWWWWKHHhHHHHHHhHHKWWWWK....",
    "...KWWWWWWKHHHHHHHHHHKWWWWWWK...",
    "..KWWWWWWWWKTHHHHHHTKWWWWWWWWK..",
    "..KWWWWWWWWwKTTHHTTKwWWWWWWWWK..",
    ".KWWWWWWWWWwKTGTTGTKwWWWWWWWWWK.",
    ".KWWWWWWWWWwKTTGGTTKwWWWWWWWWWK.",
    ".KWWWWWWWWWWwKTTTTKwWWWWWWWWWWK.",
    "KWWWWWWWWWWWwKTTTTKwWWWWWWWWWWWK",
    "KWWWWWWWWWWWWwKTTKwWWWWWWWWWWWWK",
    "KWWWwWWWWWWWWWwKKwWWWWWWWWWwWWWK",
    "KWWWwWWWWWWWWWwKKwWWWWWWWWWwWWWK",
]

SKY_TOP = (12, 16, 36)
SKY_BOTTOM = (31, 78, 121)  # #1F4E79
N = 32


def check():
    assert len(SPRITE) == N, len(SPRITE)
    for i, row in enumerate(SPRITE):
        assert len(row) == N, (i, len(row), row)
        for ch in row:
            assert ch == "." or ch in PAL, (i, ch)


def sky_color(x, y):
    bands = 6
    level = y / (N - 1) * (bands - 1)
    lo, frac = int(level), level - int(level)
    hi = frac > (0.25 + 0.5 * ((x + y) % 2))
    b = min(bands - 1, lo + (1 if hi else 0)) / (bands - 1)
    c = tuple(int(SKY_TOP[i] + (SKY_BOTTOM[i] - SKY_TOP[i]) * b) for i in range(3))
    return "#%02x%02x%02x" % c


def stars():
    rng = random.Random(11)
    out = []
    while len(out) < 14:
        x, y = rng.randrange(N), rng.randrange(20)
        if SPRITE[y][x] == "." and all(abs(x - a) + abs(y - b) > 2 for a, b, _ in out):
            out.append((x, y, rng.random() < 0.35))
    return out


def grid_colors():
    cells = []
    for y in range(N):
        row = []
        for x in range(N):
            ch = SPRITE[y][x]
            row.append(PAL[ch] if ch != "." else sky_color(x, y))
        cells.append(row)
    return cells


def runs(cells):
    out = []
    for y, row in enumerate(cells):
        x = 0
        while x < N:
            c, r = row[x], 1
            while x + r < N and row[x + r] == c:
                r += 1
            out.append(f'<rect x="{x}" y="{y}" width="{r}" height="1" fill="{c}"/>')
            x += r
    return out


def svg(scale=16):
    cells = grid_colors()
    body = runs(cells)
    st = stars()
    rng = random.Random(5)
    tw = []
    for x, y, big in st:
        dur, begin = round(rng.uniform(1.8, 3.6), 2), round(rng.uniform(0, 3), 2)
        col = "#ffffff" if big else "#a9c6ea"
        tw.append(
            f'<rect x="{x}" y="{y}" width="1" height="1" fill="{col}">'
            f'<animate attributeName="opacity" values="0.15;1;0.15" dur="{dur}s" begin="{begin}s" repeatCount="indefinite"/></rect>'
        )
    # Blink: cover the eye row with skin + lash for ~0.15s every 4.5s.
    blink = (
        '<g opacity="0"><rect x="12" y="11" width="3" height="1" fill="{L}"/>'
        '<rect x="17" y="11" width="3" height="1" fill="{L}"/>'
        '<rect x="12" y="10" width="3" height="1" fill="{S}"/>'
        '<rect x="17" y="10" width="3" height="1" fill="{S}"/>'
        '<animate attributeName="opacity" values="0;0;1;0" keyTimes="0;0.94;0.96;1" dur="4.5s" repeatCount="indefinite"/></g>'
    ).format(L=PAL["L"], S=PAL["S"])
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{N * scale}" height="{N * scale}" viewBox="0 0 {N} {N}" '
        f'shape-rendering="crispEdges" role="img" aria-label="Pixel-art portrait of Shatha Abualrob">'
        + "".join(body) + "".join(tw) + blink + "</svg>"
    )


def png(path, scale=16):
    cells = grid_colors()
    img = Image.new("RGB", (N, N))
    for y in range(N):
        for x in range(N):
            img.putpixel((x, y), tuple(int(cells[y][x][i:i + 2], 16) for i in (1, 3, 5)))
    for x, y, big in stars():
        img.putpixel((x, y), (255, 255, 255) if big else (169, 198, 234))
    img.resize((N * scale, N * scale), Image.NEAREST).save(path)


if __name__ == "__main__":
    check()
    out = sys.argv[1]
    with open(out + ".svg", "w", encoding="utf-8") as f:
        f.write(svg())
    png(out + ".png")
    print("wrote", out + ".svg", out + ".png")
