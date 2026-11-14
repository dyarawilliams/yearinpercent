#!/usr/bin/env python3
"""Dev-only: pre-render the label glyphs used by src/progressImage.js.

The bot itself has no runtime dependencies, so text is drawn from 8-bit alpha
masks stored in assets/glyphs.json. Re-run this only to change the font/size.

  pip install pillow
  python3 scripts/build-glyphs.py path/to/Poppins-ExtraBold.ttf

Font: Poppins ExtraBold (SIL Open Font License 1.1, see assets/fonts/Poppins-OFL.txt).
"""
import base64, json, sys, zlib
from PIL import Image, ImageDraw, ImageFont

SIZE = 30
CHARS = "0123456789 ProgresBa"

font = ImageFont.truetype(sys.argv[1], SIZE)
glyphs = {}
for ch in CHARS:
    l, t, r, b = font.getbbox(ch, anchor="ls")
    w, h = max(r - l, 0), max(b - t, 0)
    entry = {"advance": round(font.getlength(ch), 3), "x": l, "y": t, "w": w, "h": h, "data": ""}
    if w and h:
        im = Image.new("L", (w, h), 0)
        ImageDraw.Draw(im).text((-l, -t), ch, font=font, fill=255, anchor="ls")
        entry["data"] = base64.b64encode(zlib.compress(im.tobytes(), 9)).decode()
    glyphs[ch] = entry

out = {"font": "Poppins ExtraBold", "license": "OFL-1.1", "size": SIZE, "glyphs": glyphs}
with open("assets/glyphs.json", "w") as f:
    json.dump(out, f, indent=1)
print("wrote assets/glyphs.json")
