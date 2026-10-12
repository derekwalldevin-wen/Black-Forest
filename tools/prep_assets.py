"""
素材后处理 v2:稳健抠图 + 移动端压缩。

v1 失败原因:用"四边中位色"当背景色,但 AI 图的边缘是黑色墨线框,
导致黑狼被判成背景(离"黑"最近),而灰色底被判成主体。

v2 方案(泛洪填充 / flood fill):
  1. 先裁掉纸张白边
  2. 用"主色众数"当背景色(画面 60%+ 都是背景,众数一定落在背景上)
  3. 把所有"接近背景色"的像素做成种子,从图像四边做连通域传播
     -> 能从边缘连通的才是真背景(主体内部的暗部连不到边缘,会被保留)
  4. 取反得到主体掩码,做形态学闭运算补洞,再羽化
"""
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")


def trim_paper_border(img: Image.Image, frame_frac: float = 0.90, run: int = 6) -> Image.Image:
    """
    裁掉四周的嵌套外框(纸张白边 + 墨线黑框)。

    v3 失败原因:老实现要求整行 100% 都是 paper|dark 才算外框行,而 JPEG 噪点会在
    88px 宽的纸边里留下零星非纸像素,`~outer.all(axis=1)` 在 y=0 就成立,
    rows[0]==0 -> 一张纸边都没裁掉,cutout() 的种子环永远落在纸白上,
    seed 为空直接 break,最后退回未抠图的原图。

    这里改成"按行/列统计外框像素占比",占比 >= frame_frac 才算外框行,并且要连续
    run 行都算外框才认账(抗噪)。占位过少的图(女巫/蘑菇这类已裁掉纸边的素材)
    直接原样返回,保持它们的产出不变。
    """
    a = np.asarray(img.convert("RGB")).astype(np.int16)
    H, W, _ = a.shape
    paper = (a[:, :, 0] > 232) & (a[:, :, 1] > 232) & (a[:, :, 2] > 232)
    dark_frame = (a.max(axis=2) < 26)
    frac = (paper | dark_frame).astype(np.float32)
    is_frame_r = frac.mean(axis=1) >= frame_frac
    is_frame_c = frac.mean(axis=0) >= frame_frac

    def inward(is_frame: np.ndarray, n: int) -> int:
        """从起点往里找第一段连续 run 个非外框行,返回其起点;找不到返回 0。"""
        if is_frame.mean() < 0.02:          # 几乎没有外框 -> 这张图不需要裁
            return 0
        for i in range(0, n - run + 1):
            if not is_frame[i:i + run].any():
                return i
        return 0

    t = inward(is_frame_r, H)
    b = H - inward(is_frame_r[::-1], H)
    l = inward(is_frame_c, W)
    r = W - inward(is_frame_c[::-1], W)
    if (b - t) < 40 or (r - l) < 40:
        return img
    if (t, b, l, r) == (0, H, 0, W):
        # 这张图没有嵌套外框(女巫/蘑菇:纸边早就被裁掉了)。原实现在这种情况下
        # 仍然会内缩 3px,现有产出依赖这个裁法,这里保持一致。
        return img.crop((3, 3, W - 3, H - 3))
    return img.crop((l, t, r, b))


def dominant_bg_color(a: np.ndarray) -> np.ndarray:
    """用量化众数找背景色(背景占画面绝大多数)。"""
    q = (a // 16).astype(np.int32)
    key = q[:, :, 0] * 4096 + q[:, :, 1] * 64 + q[:, :, 2]
    vals, counts = np.unique(key, return_counts=True)
    best = vals[np.argmax(counts)]
    sel = (key == best)
    return a[sel].mean(axis=0)


def border_colors(a: np.ndarray, ring: int = 4, min_share: float = 0.02) -> np.ndarray:
    """
    从当前图像的"边缘环"取背景色集合,而不是全局主色。

    这是关键修复:AI 图常见"嵌套背景"(纸白边 -> 墨线 -> 色板 -> 主体),
    纸白边只占 3px 时全局主色会是色板,导致从纸白边起灌的泛洪直接断掉。
    边缘环能同时抓到纸白和墨线,逐层剥干净。
    """
    H, W, _ = a.shape
    r = min(ring, max(1, H // 4), max(1, W // 4))
    parts = [a[:r, :, :].reshape(-1, 3), a[-r:, :, :].reshape(-1, 3),
             a[:, :r, :].reshape(-1, 3), a[:, -r:, :].reshape(-1, 3)]
    edge = np.concatenate(parts, axis=0)

    q = (edge // 16).astype(np.int32)
    key = q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2]
    vals, counts = np.unique(key, return_counts=True)
    total = counts.sum()
    keep = vals[counts / total >= min_share]
    return edge[(q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2])[:, None] == keep[None, :]].mean(axis=1) \
        if len(keep) == 0 else np.array([edge[(q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2]) == k].mean(axis=0)
                                         for k in keep], dtype=np.float32)


def peel_background(a: np.ndarray, tol: float = 30.0, layers: int = 6,
                    nested: bool = False) -> np.ndarray:
    """
    多层剥离背景:每轮从边缘环取背景色并洪水填充,反复剥掉嵌套背景。

    nested=False(默认,原算法,女巫/蘑菇靠它出图):
      still_bg 从"全图"开始,每轮 `&= layer_bg` 越剥越紧 —— probe 一小,自适应
      容差 lo 就跟着收紧,4 轮下来把主体边缘的抗锯齿残留也一起吃掉。

    nested=True(加强版,专治狼人那种"纸白 -> 墨线 -> 均匀深灰板"三层嵌套):
      1. still_bg 从空集开始、用"并集"累积。交集只能收缩,剥掉最外层墨线框后
         still_bg 塌到 ~1% 的墨线本身,再也涨不回里面的深灰底板。
      2. 背景色集合里补上全局主色:内层大色板通常就是画面众数(狼人 24%),
         而边缘环只够得着最外层纸白/墨线,光靠边缘环永远够不到内层底板。
         只有边缘环颜色和主色差得远(>6)时才补,避免误伤边缘环已够到色板的素材。
      3. 种子环宽逐级加宽,兼容"环比外框薄"的情况(纸白 88px / 墨线 6px)。
    """
    H, W, _ = a.shape
    still_bg = np.zeros((H, W), dtype=bool) if nested \
        else np.ones((H, W), dtype=bool)
    mode_color = dominant_bg_color(a) if nested else None

    for _ in range(layers):
        probe = still_bg
        if nested and not probe.any():
            probe = np.ones((H, W), dtype=bool)
        if probe.mean() < 0.06 and not nested:
            break
        bgs = border_colors_robust(a, probe)
        if mode_color is not None and (
                len(bgs) == 0
                or bool((np.abs(bgs - mode_color).max(axis=1) > 6.0).all())):
            bgs = np.vstack([bgs, mode_color[None, :]]) \
                if len(bgs) else mode_color[None, :]
        if len(bgs) == 0:
            break

        d2 = ((a[:, :, None, :] - bgs[None, None, :, :]) ** 2).sum(axis=3)
        dist = np.sqrt(d2.min(axis=2))

        # 自适应容差
        lo, hi = 4.0, tol
        while lo < hi:
            mid = (lo + hi) / 2
            if (dist < mid)[probe].mean() > 0.985:
                hi = mid
            else:
                lo = mid + 0.5
        cand_bg = (dist < lo) & probe

        # 种子 = 边缘环上"像背景"的像素;沿 cand_bg 向内连通传播。
        # 环宽自适应:嵌套外框可能比环厚(纸白 88px / 墨线 6px),环太窄时
        # 环内全是纸白 -> seed 空 -> 整个抠图空转退回原图。逐级加宽直到命中。
        seed = np.zeros((H, W), dtype=bool)
        for r in (3, 6, 12, 24, 48, 96, 160):
            r = min(r, H // 2, W // 2)
            ring = np.zeros((H, W), dtype=bool)
            ring[:r, :] = True
            ring[-r:, :] = True
            ring[:, :r] = True
            ring[:, -r:] = True
            seed = cand_bg & ring
            if seed.any():
                break
        if not seed.any():
            break

        # binary_propagation:沿 mask(cand_bg) 传播 seed,不会被主体挡住,
        # 也不会像 ndimage.label 那样在"全连通"时退化成标量
        layer_bg = ndimage.binary_propagation(seed, mask=cand_bg)
        if layer_bg.all():
            break
        if nested:
            grown = still_bg | layer_bg
            stalled = grown.sum() <= still_bg.sum() + 256
        else:
            grown = still_bg & layer_bg
            stalled = False
        still_bg = grown
        if stalled:
            break                               # 没进展 -> 再剥也是白剥
    return still_bg


def subject_mask(a: np.ndarray, background: np.ndarray, close: int = 7,
                 drop_edge: bool = False) -> np.ndarray:
    """背景取反 -> (可选)剔掉外框碎屑 -> 形态学补洞。"""
    H, W, _ = a.shape
    subject = ~background

    if drop_edge:
        # 剥掉嵌套外框后会残留外框碎屑,两种形态都得清掉:
        #  a) 贴着画布边缘的闭环(纸白 / 墨线框)。它本身是背景,但首尾相连,
        #     后面的 fill_holes 会把整块底板当成洞填回去 -> 狼人整张变不透明。
        #  b) 面积只有主体零头的碎条(狼人右边残留 21x1740 的墨线竖条)。
        #     真正的立绘主体不会贴到画布边缘,也不会是这种细长条。
        edge = np.zeros((H, W), dtype=bool)
        edge[:2, :] = edge[-2:, :] = True
        edge[:, :2] = edge[:, -2:] = True
        lab, n_comp = ndimage.label(subject)
        if n_comp > 1:
            sizes = np.asarray(ndimage.sum(subject, lab, range(1, n_comp + 1)))
            keep = np.flatnonzero(sizes >= 0.05 * sizes.max()) + 1
            touching = np.unique(lab[edge & subject])
            keep = keep[~np.isin(keep, touching[touching > 0])]
            subject = np.isin(lab, keep)

    # 补洞:主体内部的浅色区域(眼睛/高光)被误判成背景
    subject = ndimage.binary_closing(subject, structure=np.ones((close, close)))
    subject = ndimage.binary_fill_holes(subject)
    subject = ndimage.binary_opening(subject, structure=np.ones((3, 3)))
    return subject


def cutout(img: Image.Image, tol: float = 30.0, close: int = 7, feather: float = 1.3,
           layers: int = 6) -> Image.Image:
    """
    抠图:剥掉嵌套背景 -> 取反得到主体 -> 羽化成软 alpha。

    v4:先走原算法;结果明显不合理时(主体占满整张画布 = 外框没剥干净,
    抠出来的其实是"底板+白边")再用加强版重试一次。狼人原图就是这种三层嵌套。
    """
    a = np.asarray(img.convert("RGB")).astype(np.float32)

    subject = subject_mask(a, peel_background(a, tol, 4))
    if not 0.04 < subject.mean() < 0.92:
        subject = subject_mask(a, peel_background(a, tol, layers, nested=True),
                               drop_edge=True)

    # 太碎就退回原图(抠失败不如不抠)
    if subject.mean() < 0.04 or subject.mean() > 0.92:
        return img.convert("RGBA")

    # 羽化成软 alpha
    alpha = ndimage.distance_transform_edt(subject).astype(np.float32)
    alpha = np.clip(alpha / max(feather, 0.5), 0, 1)
    # 边缘外扩一点,避免切掉主体轮廓
    alpha = np.maximum(alpha, ndimage.grey_erosion(subject.astype(np.float32), size=1) * 0.98)

    rgba = np.dstack([a, alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def crop_to_content(img: Image.Image, pad_ratio: float = 0.02) -> Image.Image:
    a = np.asarray(img)
    alpha = a[:, :, 3]
    ys, xs = np.where(alpha > 12)
    if len(ys) == 0:
        return img
    y0, y1 = ys.min(), ys.max()
    x0, x1 = xs.min(), xs.max()
    ph = int((y1 - y0) * pad_ratio) + 2
    pw = int((x1 - x0) * pad_ratio) + 2
    return img.crop((max(0, x0 - pw), max(0, y0 - ph),
                     min(a.shape[1], x1 + pw), min(a.shape[0], y1 + ph)))


def border_colors_robust(a: np.ndarray, valid: np.ndarray, ring: int = 4,
                         min_share: float = 0.02) -> np.ndarray:
    """从 valid 区域的边缘环取背景色集合(忽略已剥离像素)。"""
    H, W, _ = a.shape
    r = min(ring, max(1, H // 4), max(1, W // 4))
    mask = np.zeros((H, W), dtype=bool)
    mask[:r, :] = True
    mask[-r:, :] = True
    mask[:, :r] = True
    mask[:, -r:] = True
    sel = mask & valid
    edge = a[sel]
    if edge.shape[0] < 32:
        return np.zeros((0, 3), dtype=np.float32)

    q = (edge // 16).astype(np.int32)
    key = q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2]
    vals, counts = np.unique(key, return_counts=True)
    keep = vals[counts / counts.sum() >= min_share]
    out = np.array([edge[key == k].mean(axis=0) for k in keep], dtype=np.float32)
    return out.reshape(-1, 3)


def process_character(name: str, max_h: int = 1100) -> str:
    src = os.path.join(ASSETS, name + ".jpg")
    dst = os.path.join(ASSETS, name + ".png")
    img = Image.open(src).convert("RGB")
    img = trim_paper_border(img)
    img = cutout(img)
    img = crop_to_content(img)
    img = img.filter(ImageFilter.GaussianBlur(0.4))

    w, h = img.size
    if h > max_h:
        img = img.resize((int(w * max_h / h), max_h), Image.LANCZOS)

    img.save(dst, "PNG", optimize=True)
    return f"{name}.png  {img.size[0]}x{img.size[1]}  {os.path.getsize(dst)//1024}KB"


def to_webp(name: str, max_w: int, quality: int = 84) -> str:
    src = os.path.join(ASSETS, name + ".jpg")
    dst = os.path.join(ASSETS, name + ".webp")
    img = Image.open(src).convert("RGB")
    w, h = img.size
    if w > max_w:
        img = img.resize((max_w, int(h * max_w / w)), Image.LANCZOS)
    img.save(dst, "WEBP", quality=quality, method=6)
    return f"{name}.webp  {img.size[0]}x{img.size[1]}  {os.path.getsize(dst)//1024}KB"


if __name__ == "__main__":
    import sys
    if "--all" in sys.argv:
        print("== characters ==")
        for n in ["enemy-wolf", "enemy-witch", "enemy-mushroom"]:
            try:
                print("  ", process_character(n))
            except Exception as e:
                print("   FAIL", n, repr(e))
        print("== compress ==")
        print("  ", to_webp("bg-forest", 1080, 82))
        print("  ", to_webp("card-back", 560, 86))
    else:
        print("  ", process_character(sys.argv[1] if len(sys.argv) > 1 else "enemy-wolf"))
