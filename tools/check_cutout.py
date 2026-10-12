"""把抠好的立绘合成到棋盘格背景上,方便肉眼检查透明通道和边缘。"""
import os
import numpy as np
from PIL import Image

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
NAMES = ["enemy-wolf", "enemy-witch", "enemy-mushroom"]


def main():
    cell = (360, 480)
    sheet = Image.new("RGB", (cell[0] * 3, cell[1]), (255, 255, 255))
    d = np.asarray(sheet).copy()
    s = 24
    for y in range(0, cell[1], s):
        for x in range(0, cell[0], s):
            if (x // s + y // s) % 2 == 0:
                d[y:y + s, x:x + s] = (205, 205, 212)
    sheet = Image.fromarray(d)

    for i, n in enumerate(NAMES):
        p = os.path.join(ASSETS, n + ".png")
        im = Image.open(p).convert("RGBA")
        im.thumbnail((cell[0] - 16, cell[1] - 16), Image.LANCZOS)
        bg = Image.new("RGBA", cell, (0, 0, 0, 0))
        bg.paste(im, ((cell[0] - im.width) // 2, (cell[1] - im.height) // 2), im)
        sheet.paste(bg.convert("RGB"), (i * cell[0], 0))

    out = os.path.join(ASSETS, "_check_sheet.png")
    sheet.save(out)
    print("wrote", out, os.path.getsize(out) // 1024, "KB")


if __name__ == "__main__":
    main()
