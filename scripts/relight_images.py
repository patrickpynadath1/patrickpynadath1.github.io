"""Make light-theme versions of dark-theme figures (PNG and animated GIF).

How the mapping works (in OKLCH color space):
  * Lightness is flipped and rescaled so the dark page background becomes the light page
    background (#f6f5fa) and white text becomes the light theme's dark text (#302e42).
  * Near-neutral pixels (backgrounds, grid lines, text) take on the site's purple tint,
    so plot backgrounds match the light theme.
  * Colored pixels (data lines, markers, labels) keep their hue and saturation, so
    MDLM stays red, DUO blue, CANDI green; only their lightness changes so they read on light.
Anti-aliased edges stay smooth because the mapping is continuous.

Usage:
  python3 scripts/relight_images.py public/images/recent_cont_dlm_content/*.gif ...
Writes `<name>-light.<ext>` next to each input and updates src/data/light_images.json.
"""
import json, pathlib, sys
import numpy as np
from PIL import Image

# Lightness anchors (OKLab L). Dark: page background .. white. Light: page background .. text.
# Everything at or below the plot-panel lightness becomes pure white.
DARK_BG_L, DARK_FG_L = 0.27, 1.00
LIGHT_BG_L, LIGHT_FG_L = 1.0, 0.30
THEME_HUE = 300.0 * np.pi / 180  # OKLCH hue of the site's purple tint
THEME_TINT = 0.012                 # chroma given to neutral pixels
NEUTRAL_C = 0.035                  # chroma below this counts as neutral
COLORED_C = 0.09                   # chroma above this keeps its full color


def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def rgb_to_oklab(rgb):
    r, g, b = srgb_to_linear(rgb).T
    l = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], axis=1)


def oklab_to_rgb(lab):
    L, a, b = lab.T
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    rgb = np.stack([4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s], axis=1)
    return linear_to_srgb(rgb)


def relight(rgb):
    """Map an (N, 3) array of sRGB values in 0..255 to their light-theme colors."""
    lab = rgb_to_oklab(rgb.astype(np.float64) / 255)
    L, a, b = lab.T
    C = np.hypot(a, b)
    h = np.arctan2(b, a)

    # Flip lightness: dark background -> light background, white -> dark text.
    # The 0.8 power keeps faint grid lines visible against the white background.
    t = np.clip((L - DARK_BG_L) / (DARK_FG_L - DARK_BG_L), 0, 1) ** 0.8
    L2 = LIGHT_BG_L + t * (LIGHT_FG_L - LIGHT_BG_L)

    # Colored pixels: keep hue; keep them a little darker than mid so they read on light.
    # Dark, muted blues (plot panels) count as background, not data.
    w = np.clip((C - NEUTRAL_C) / (COLORED_C - NEUTRAL_C), 0, 1)  # 0 neutral .. 1 colored
    w *= np.clip((L - 0.27) / 0.06, 0, 1)
    L_colored = np.clip(0.98 - 0.62 * L, 0.38, 0.72)
    L_out = (1 - w) * L2 + w * L_colored

    # Tint mid-grays only: the background stays pure white and text stays neutral.
    C_out = (1 - w) * THEME_TINT * 4 * t * (1 - t) + w * np.minimum(C * 1.05, 0.22)
    h_out = np.where(w > 0, h, THEME_HUE)
    lab_out = np.stack([L_out, C_out * np.cos(h_out), C_out * np.sin(h_out)], axis=1)

    # Pull out-of-gamut colors back by lowering chroma.
    out = oklab_to_rgb(lab_out)
    for _ in range(6):
        raw = oklab_to_rgb_raw(lab_out)
        bad = np.any((raw < -1e-4) | (raw > 1 + 1e-4), axis=1)
        if not bad.any():
            break
        lab_out[bad, 1:] *= 0.85
        out = oklab_to_rgb(lab_out)
    return np.round(out * 255).astype(np.uint8)


def oklab_to_rgb_raw(lab):
    L, a, b = lab.T
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    lin = np.stack([4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s], axis=1)
    return lin


def relight_palette(pal):
    arr = np.array(pal, dtype=np.uint8).reshape(-1, 3)
    return relight(arr).reshape(-1).tolist()


def _box_mean(a, r):
    """Mean over a (2r+1) x (2r+1) window, edges padded."""
    p = np.pad(a, ((r + 1, r), (r + 1, r)) + ((0, 0),) * (a.ndim - 2), mode='edge').astype(np.float64)
    c = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def keep_white_on_color(src, dst, radius=6):
    """White text drawn on a colored shape (like numbered badges) should stay white.

    The global mapping turns white into dark text, which disappears on a dark badge.
    Here we find light, neutral pixels that are mostly surrounded by saturated color,
    and repaint them as white blended with the badge's new color so edges stay smooth.
    """
    h, w_, _ = src.shape
    lab = rgb_to_oklab(src.reshape(-1, 3).astype(np.float64) / 255).reshape(h, w_, 3)
    L = lab[..., 0]
    C = np.hypot(lab[..., 1], lab[..., 2])
    colored = (C > 0.09) & (L > 0.45)
    if not colored.any():
        return dst
    frac = _box_mean(colored.astype(np.float64), radius)
    cnt = np.maximum(frac, 1e-9)
    L_badge = _box_mean(np.where(colored, L, 0.0), radius) / cnt
    zone = (frac > 0.45) & ~colored & (L > L_badge + 0.04)
    if not zone.any():
        return dst
    badge_rgb = _box_mean(np.where(colored[..., None], dst, 0).astype(np.float64), radius) / cnt[..., None]
    mix = np.clip((L - L_badge) / np.maximum(1.0 - L_badge, 1e-6), 0, 1)[..., None]
    repainted = mix * 255 + (1 - mix) * badge_rgb
    out = dst.copy()
    out[zone] = np.round(repainted[zone]).astype(np.uint8)
    return out


_cache_keys = np.empty(0, dtype=np.int64)
_cache_vals = np.empty((0, 3), dtype=np.uint8)


def relight_rgb_image(im):
    """Relight every pixel, mapping each distinct color once (cached across GIF frames)."""
    global _cache_keys, _cache_vals
    arr = np.asarray(im.convert('RGBA'))
    flat = arr[..., :3].reshape(-1, 3).astype(np.int64)
    keys = (flat[:, 0] << 16) | (flat[:, 1] << 8) | flat[:, 2]
    uniq, inv = np.unique(keys, return_inverse=True)
    new = uniq[~np.isin(uniq, _cache_keys)]
    if len(new):
        rgb = np.stack([(new >> 16) & 255, (new >> 8) & 255, new & 255], axis=1)
        _cache_keys = np.concatenate([_cache_keys, new])
        _cache_vals = np.concatenate([_cache_vals, relight(rgb)])
        order = np.argsort(_cache_keys)
        _cache_keys, _cache_vals = _cache_keys[order], _cache_vals[order]
    mapped = _cache_vals[np.searchsorted(_cache_keys, uniq)][inv.reshape(-1)]
    mapped = keep_white_on_color(arr[..., :3], mapped.reshape(arr.shape[:2] + (3,)))
    return Image.fromarray(np.dstack([mapped, arr[..., 3]]), 'RGBA')


def process(path):
    path = pathlib.Path(path)
    out = path.with_name(f'{path.stem}-light{path.suffix}')
    im = Image.open(path)
    if path.suffix.lower() == '.gif' and getattr(im, 'n_frames', 1) > 1:
        frames, durations = [], []
        for i in range(im.n_frames):
            im.seek(i)
            durations.append(im.info.get('duration', 100))
            frames.append(relight_rgb_image(im.convert('RGB')).convert('RGB'))
        # One shared palette, built from pixels sampled across every frame,
        # keeps colors stable from frame to frame.
        rng = np.random.default_rng(0)
        samples = []
        for f in frames:
            a = np.asarray(f).reshape(-1, 3)
            samples.append(a[rng.choice(len(a), size=min(len(a), 400_000 // len(frames) + 2000), replace=False)])
        pool = np.concatenate(samples)
        side = int(np.ceil(np.sqrt(len(pool))))
        pool = np.concatenate([pool, np.repeat(pool[:1], side * side - len(pool), axis=0)])
        base = Image.fromarray(pool.reshape(side, side, 3), 'RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT)
        pal_frames = [f.quantize(palette=base, dither=Image.Dither.NONE) for f in frames]
        pal_frames[0].save(out, save_all=True, append_images=pal_frames[1:], duration=durations,
                           loop=im.info.get('loop', 0), optimize=False, disposal=1)
    else:
        img = relight_rgb_image(im)
        if im.mode != 'RGBA':
            img = img.convert('RGB')
        img.save(out, optimize=True)
    return out


if __name__ == '__main__':
    repo = pathlib.Path(__file__).resolve().parents[1]
    manifest_path = repo / 'src' / 'data' / 'light_images.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
    from multiprocessing import Pool
    paths = sys.argv[1:]
    with Pool() as pool:
        for p, out in zip(paths, pool.imap(process, paths)):
            web = '/' + str(pathlib.Path(p).resolve().relative_to(repo / 'public'))
            if web not in manifest:
                manifest.append(web)
            print(f'{p} -> {out.name}', flush=True)
    manifest_path.write_text(json.dumps(sorted(manifest), indent=2) + '\n')
