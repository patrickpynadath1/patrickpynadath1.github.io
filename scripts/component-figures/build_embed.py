"""Turn combined.html (the artifact page) into the version embedded in the blog post.

Writes a full HTML document for public/figures/design-map/index.html. Changes from the artifact:
  * no page header (the post supplies its own heading and text),
  * no outer page padding,
  * follows the post's light/dark theme and resizes its iframe to fit,
  * code popups open where the reader is looking, not in the middle of the tall frame.
Usage: python3 build_embed.py combined.html out.html
"""
import re, sys

src, out = sys.argv[1], sys.argv[2]
s = open(src).read()

s = re.sub(r'<p class="eyebrow">Interactive figure</p>\s*<h1>.*?</h1>\s*<p class="lede">.*?</p>\s*', '', s, count=1, flags=re.S)
s = s.replace('<title>Diffusion Design Map</title>', '')
s = re.sub(r'<meta name="description"[^>]*>\s*', '', s, count=1)
# Scroll part 2 into the reader's view using the post's viewport, not the frame's.
old = "r.getBoundingClientRect().top > window.innerHeight - 120"
assert old in s
s = s.replace(old, "r.getBoundingClientRect().top + frameTop() > viewH() - 120")

embed_css = """
  /* ---- embedded in the blog post ---- */
  html, body { background: var(--bg); }
  .page { max-width: none; padding: 0; }
  .top-controls { margin-top: 0; }
  .part:first-of-type { margin-top: 20px; }
  .code-dialog { margin: 0 auto; }
"""
embed_js = """
<script>
// Embedded mode: match the post's theme, size the iframe to the content,
// and place modal popups inside the part of the frame the reader can see.
function frameTop() { try { return window.frameElement ? window.frameElement.getBoundingClientRect().top : 0; } catch (e) { return 0; } }
function viewH() { try { return window.frameElement ? parent.innerHeight : window.innerHeight; } catch (e) { return window.innerHeight; } }
(function () {
  var root = document.documentElement, host = null;
  try { host = window.frameElement ? parent.document.documentElement : null; } catch (e) {}
  function syncTheme() { if (host && host.dataset.theme) root.dataset.theme = host.dataset.theme; }
  if (host) { syncTheme(); new MutationObserver(syncTheme).observe(host, { attributes: true, attributeFilter: ['data-theme'] }); }
  function fit() {
    if (!window.frameElement) return;
    var h = Math.ceil(document.querySelector('.page').getBoundingClientRect().height) + 4;
    window.frameElement.style.height = h + 'px';
  }
  new ResizeObserver(fit).observe(document.querySelector('.page'));
  window.addEventListener('load', fit);
  fit();
  var dlg = document.getElementById('code-dialog');
  function place() {
    if (!dlg.open || !window.frameElement) { dlg.style.top = ''; dlg.style.maxHeight = ''; return; }
    var vh = viewH(), top = Math.max(0, -frameTop()) + 16;
    dlg.style.position = 'fixed'; dlg.style.top = top + 'px'; dlg.style.bottom = 'auto';
    dlg.style.maxHeight = Math.min(900, vh - 32) + 'px';
  }
  new MutationObserver(place).observe(dlg, { attributes: true, attributeFilter: ['open'] });
})();
</script>
"""
s = s.replace('</style>', embed_css + '</style>', 1)
doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
       '<title>Design map figure</title>\n<meta name="robots" content="noindex">\n</head>\n<body>\n'
       + s + embed_js + '</body>\n</html>\n')
open(out, 'w').write(doc)
