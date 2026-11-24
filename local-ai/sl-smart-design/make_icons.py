"""Draws the SL Smart Design tab's ribbon icons (manifest-slsd.xml) at 16, 32 and 80 px into local-ai/assets/slsd.
A web add-in's buttons need image files (no built-in Office images), so the original buttons' pictures are redrawn as
one consistent, simple set in the LVC colours. Standard library only (4x4 supersampled shapes, zlib PNG).
Usage: python make_icons.py"""
import math, os, struct, zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'slsd')
BLUE, SKY, ORANGE, INK, GREY, WHITE, RED = '#1179EF', '#62B7E4', '#E6A157', '#404040', '#9AA3AE', '#FFFFFF', '#D9534F'
SS = 4


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


class Canvas:
    def __init__(self, n):
        self.n, self.N = n, n * SS
        self.px = [[0.0, 0.0, 0.0, 0.0] for _ in range(n * n)]      # premultiplied rgba

    def _paint(self, inside, color, bbox):
        r, g, b = (c / 255 for c in rgb(color))
        n, N = self.n, self.N
        x0, y0, x1, y1 = (max(0, min(n, int(math.floor(v * n)) + d)) for v, d in zip(bbox, (-1, -1, 2, 2)))
        for py in range(y0, y1):
            for px in range(x0, x1):
                cov = 0
                for sy in range(SS):
                    for sx in range(SS):
                        if inside((px * SS + sx + 0.5) / N, (py * SS + sy + 0.5) / N):
                            cov += 1
                if cov:
                    a = cov / (SS * SS)
                    p = self.px[py * n + px]
                    p[0] = r * a + p[0] * (1 - a); p[1] = g * a + p[1] * (1 - a); p[2] = b * a + p[2] * (1 - a); p[3] = a + p[3] * (1 - a)

    def rrect(self, x0, y0, x1, y1, rad, color):
        def f(x, y):
            if not (x0 <= x <= x1 and y0 <= y <= y1):
                return False
            cx, cy = min(max(x, x0 + rad), x1 - rad), min(max(y, y0 + rad), y1 - rad)
            return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad
        self._paint(f, color, (x0, y0, x1, y1))

    def frame(self, x0, y0, x1, y1, w, rad, color):
        def f(x, y):
            def ins(a0, b0, a1, b1, r):
                if not (a0 <= x <= a1 and b0 <= y <= b1):
                    return False
                cx, cy = min(max(x, a0 + r), a1 - r), min(max(y, b0 + r), b1 - r)
                return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
            return ins(x0, y0, x1, y1, rad) and not ins(x0 + w, y0 + w, x1 - w, y1 - w, max(rad - w, 0))
        self._paint(f, color, (x0, y0, x1, y1))

    def line(self, ax, ay, bx, by, w, color):
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy or 1e-9

        def f(x, y):
            t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / L2))
            return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 <= (w / 2) ** 2
        self._paint(f, color, (min(ax, bx) - w, min(ay, by) - w, max(ax, bx) + w, max(ay, by) + w))

    def circle(self, cx, cy, r, color):
        self._paint(lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 <= r * r, color, (cx - r, cy - r, cx + r, cy + r))

    def poly(self, pts, color):
        def f(x, y):
            c = False
            for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
                if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                    c = not c
            return c
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        self._paint(f, color, (min(xs), min(ys), max(xs), max(ys)))

    def png(self):
        raw = b''
        for y in range(self.n):
            raw += b'\x00'
            for x in range(self.n):
                r, g, b, a = self.px[y * self.n + x]
                raw += bytes([int(round(r / a * 255)) if a else 0, int(round(g / a * 255)) if a else 0, int(round(b / a * 255)) if a else 0, int(round(a * 255))])
        chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)
        return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', self.n, self.n, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


def slide(c, color=INK):
    c.frame(.08, .16, .92, .84, .07, .06, color)


ICONS = {
    # Alternative Design: a gallery of layouts, one chosen
    'design': lambda c: [c.rrect(.08, .08, .47, .47, .07, SKY), c.rrect(.53, .08, .92, .47, .07, ORANGE),
                         c.rrect(.08, .53, .47, .92, .07, SKY), c.rrect(.53, .53, .92, .92, .07, SKY)],
    'footer-note': lambda c: [slide(c), c.rrect(.15, .64, .85, .77, .03, BLUE)],
    'footer-info': lambda c: [slide(c), c.rrect(.27, .64, .85, .77, .03, BLUE), c.circle(.2, .705, .07, ORANGE)],
    'code-blue': lambda c: [c.rrect(.08, .16, .92, .84, .08, BLUE), c.line(.22, .34, .55, .34, .07, WHITE), c.line(.3, .5, .72, .5, .07, WHITE), c.line(.22, .66, .48, .66, .07, WHITE)],
    'code-black': lambda c: [c.rrect(.08, .16, .92, .84, .08, INK), c.line(.22, .34, .55, .34, .07, WHITE), c.line(.3, .5, .72, .5, .07, WHITE), c.line(.22, .66, .48, .66, .07, WHITE)],
    'problem': lambda c: [c.rrect(.05, .28, .4, .72, .06, ORANGE), c.rrect(.6, .28, .95, .72, .06, BLUE), c.line(.42, .5, .55, .5, .07, INK),
                          c.poly([(.5, .4), (.6, .5), (.5, .6)], INK)],
    'problem-image': lambda c: [c.rrect(.05, .28, .4, .72, .06, ORANGE), c.frame(.6, .28, .95, .72, .06, .06, BLUE),
                                c.poly([(.65, .66), (.74, .48), (.82, .6), (.86, .54), (.91, .66)], BLUE), c.line(.42, .5, .55, .5, .07, INK),
                                c.poly([(.5, .4), (.6, .5), (.5, .6)], INK)],
    'no-animation': lambda c: [c.poly([(.3, .2), (.82, .5), (.3, .8)], BLUE), c.line(.14, .86, .86, .14, .1, RED)],
    'delete-empty': lambda c: [*[c.line(x, .16, x + .1, .16, .06, GREY) for x in (.1, .3, .5, .7)], *[c.line(x, .84, x + .1, .84, .06, GREY) for x in (.1, .3, .5, .7)],
                               *[c.line(.08, y, .08, y + .1, .06, GREY) for y in (.24, .44, .64)], *[c.line(.92, y, .92, y + .1, .06, GREY) for y in (.24, .44, .64)],
                               c.line(.35, .35, .65, .65, .09, RED), c.line(.65, .35, .35, .65, .09, RED)],
    'rename-text': lambda c: [c.frame(.06, .2, .94, .8, .06, .06, GREY), c.line(.3, .35, .7, .35, .09, BLUE), c.line(.5, .35, .5, .68, .09, BLUE)],
    # 10.25 SL Editor: the add-in (rounded gradient-like tile with a layout and a spark), SL Design, SL Animation
    'sleditor': lambda c: [c.rrect(.04, .04, .96, .96, .24, '#3645A9'), c.rrect(.04, .5, .96, .96, .24, '#2F7FD0'), c.rrect(.04, .5, .96, .7, 0, '#3363BE'),
                           c.rrect(.22, .25, .58, .5, .07, WHITE), c.rrect(.22, .57, .44, .75, .06, '#C9D8F5'), c.rrect(.52, .57, .78, .75, .06, '#E6EEFB'),
                           c.poly([(.75, .14), (.79, .25), (.9, .29), (.79, .33), (.75, .44), (.71, .33), (.6, .29), (.71, .25)], '#FFD66B')],
    'sldesign': lambda c: [c.rrect(.06, .1, .94, .9, .1, '#E9EEFB'), c.rrect(.14, .2, .5, .52, .06, SKY), c.circle(.7, .36, .15, ORANGE), c.rrect(.14, .62, .86, .72, .03, BLUE), c.rrect(.14, .76, .6, .82, .02, GREY)],
    'slanimation': lambda c: [c.circle(.42, .5, .34, BLUE), c.poly([(.32, .32), (.6, .5), (.32, .68)], WHITE), c.circle(.84, .3, .08, ORANGE), c.circle(.88, .55, .06, SKY), c.circle(.8, .78, .05, ORANGE)],
    'rename-heading': lambda c: [c.frame(.06, .2, .94, .8, .06, .06, GREY), c.line(.32, .33, .32, .68, .09, ORANGE), c.line(.68, .33, .68, .68, .09, ORANGE), c.line(.32, .5, .68, .5, .09, ORANGE)],
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, draw in ICONS.items():
        for n in (16, 32, 80):
            c = Canvas(n)
            draw(c)
            with open(os.path.join(OUT, f'{name}-{n}.png'), 'wb') as f:
                f.write(c.png())
    print(f'{len(ICONS) * 3} icons written to {os.path.normpath(OUT)}')


if __name__ == '__main__':
    main()
