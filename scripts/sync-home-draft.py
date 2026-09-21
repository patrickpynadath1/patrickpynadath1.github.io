"""Refresh the standalone homepage draft from the website's canonical JSON data."""
import html
import hashlib
import json
import struct
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
def load(name):
    return json.loads((ROOT / 'src/data' / f'{name}.json').read_text())
h = html.escape
info = load('personal-info')
projects = load('projects')
education = load('education')
experience = load('experience')
path = ROOT / 'public/home-draft/index.html'
page = path.read_text()

def replace_panel(name, content):
    global page
    pattern = rf'(<section class="panel" role="tabpanel" id="panel-{name}"[^>]*>).*?</section>'
    page, count = re.subn(pattern, lambda m: m[1] + content + '</section>', page, flags=re.S)
    if count != 1:
        raise ValueError(f'Expected one {name} panel, got {count}')

replace_panel('about', f'<div class="section-intro"><h2>About me</h2><p class="section-lead">{h(info["bio"][0])}</p></div><div class="about-columns"><div><h3>Research interests</h3><p>{h(info["bio"][1])}</p></div></div>')
replace_panel('cats', """<div class="section-intro"><h2>My cats</h2><p class="section-lead">Meet my two research assistants.</p></div><div class="cats cat-profiles"><figure><img src="/images/missy.jpg" alt="Missy" width="350" height="350"><figcaption><h3>Missy</h3></figcaption></figure><figure><img src="/images/boba.jpg" alt="Boba" width="350" height="350"><figcaption><h3>Boba</h3></figcaption></figure></div><div class="cat-description"><p>Missy specializes in Supervised Keyboard Tuning (SKT) (demonstrated when I am coding); while Boba is our resident expert in discrete nap optimization. They are a crucial component of every research project.</p></div>""")
contact_links = ''.join(f'<a href="{h(info["links"][key], quote=True)}"><span>{label}</span><span aria-hidden="true">↗</span></a>' for key, label in [('linkedin','LinkedIn'),('github','GitHub'),('twitter','Twitter')])
replace_panel('contact', f'<div class="section-intro"><h2>Get in touch</h2><p class="section-lead">Whether you’re looking to collaborate on a project, have a question about my work, or just want to say hello, I’d love to hear from you!</p></div><a class="email-feature" href="mailto:{h(info["links"]["email"])}"><span><span class="eyebrow">Email</span><strong>{h(info["links"]["email"])}</strong></span><span aria-hidden="true">↗</span></a><div class="contact-directory">{contact_links}</div>')
replace_panel('education', '<h2>Education</h2>' + ''.join(f'<article class="education-item"><h3>{h(e["degree"])}</h3><p>{h(e["institution"])}</p><p>{h(e["timeframe"])}</p></article>' for e in education))
research = '<h2>Research projects</h2>'
for p in projects:
    authors = ', '.join(h(a['name']) + ('*' if a.get('equalContribution') else '') for a in p['authors'])
    note = '<p class="authors">* Equal contribution</p>' if any(a.get('equalContribution') for a in p['authors']) else ''
    links = ''.join(f'<a href="{h(url, quote=True)}">{ {"website":"Project", "arxiv":"Paper", "github":"Code"}.get(label,label.title())}</a>' for label, url in p['links'].items())
    details = ''
    for section in p['sections']:
        details += f'<h4>{h(section["title"])}</h4>'
        if section.get('content'):
            details += '<p>' + h(section['content']) + '</p>'
        if section.get('bullets'):
            details += '<ul>' + ''.join('<li>' + h(b) + '</li>' for b in section['bullets']) + '</ul>'
    research += f'<article class="project" id="project-{h(p["id"])}"><span class="venue">{h(p["conference"])}</span><h3>{h(p["title"])}</h3><p class="authors">{authors}</p>{note}<p>{h(p["tldr"])}</p><div class="links">{links}</div><details><summary>Read more</summary>{details}</details></article>'
replace_panel('research', research)
experience_html = '<div class="section-intro"><h2>Experience</h2></div><div class="career-list">'
for item in experience:
    bullets = ''.join('<li>' + h(b) + '</li>' for b in item['bullets'])
    experience_html += f'<article class="career-entry"><div class="career-date">{h(item["timeframe"])}</div><div class="career-body"><span class="eyebrow">{h(item["role"])}</span><h3>{h(item["organization"])}</h3><ul>{bullets}</ul></div></article>'
experience_html += '</div>'
if 'id="panel-experience"' not in page:
    page = page.replace('<section class="panel" role="tabpanel" id="panel-contact"', '<section class="panel" role="tabpanel" id="panel-experience" aria-labelledby="tab-experience" tabindex="0" hidden></section><section class="panel" role="tabpanel" id="panel-contact"')
replace_panel('experience', experience_html)
labels = {'about':'About me','cats':'Cats','research':'Research projects','education':'Education','experience':'Experience','contact':'Contact'}
tabs = ''.join(f'<button type="button" role="tab" id="tab-{id}" aria-controls="panel-{id}" aria-selected="false" aria-expanded="false" data-section="{id}">{label}</button>' for id, label in labels.items())
page = re.sub(r'(<nav class="tabs"[^>]*>).*?</nav>', lambda m:m[1] + tabs + '</nav>', page, flags=re.S)
if 'aria-label="Google Scholar"' not in page:
    scholar = f'<a href="{h(info["links"]["scholar"],quote=True)}" aria-label="Google Scholar" title="Google Scholar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 9 10-6 10 6-10 6z M6 12v6c4 3 8 3 12 0v-6 M22 9v8"/></svg></a>'
    page = re.sub(r'(<nav class="socials"[^>]*>.*?)(</nav>)', lambda m:m[1] + scholar + m[2], page, flags=re.S)
# Render the actual first animation frame into HTML: no image/SVG handoff.
ET.register_namespace('', 'http://www.w3.org/2000/svg')
svg = ET.fromstring((ROOT / 'public/wave-study/shape.svg').read_text())
svg.set('viewBox', '-20 -22 336 347')
svg.set('aria-hidden', 'true')
models = json.loads((ROOT / 'public/wave-study/wave-model.json').read_text())
paths = list(svg.iter('{http://www.w3.org/2000/svg}path'))
loop = (ROOT / 'public/home-draft/wave-loop.bin').read_bytes()
svg.set('data-loop-src', './wave-loop.bin?v=' + hashlib.sha256(loop).hexdigest()[:12])
svg.set('data-loop-fps', '15')
loop_values = struct.unpack('<' + 'h' * (len(loop)//2), loop)
point_offset = 0
for index, svg_path in enumerate(paths):
    numbers = [float(n) for n in re.findall(r'[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?', svg_path.get('d'), re.I)]
    points = [(x, loop_values[point_offset+i]/100) for i, x in enumerate(numbers[::2])]
    point_offset += len(points)
    svg_path.set('data-points', json.dumps(points, separators=(',', ':')))
    svg_path.set('data-frequency', str(models[index]['frequency']))
    d = f'M {points[0][0]:.2f} {points[0][1]:.2f}'
    for i in range(len(points) - 1):
        p0, p1, p2, p3 = points[max(0, i-1)], points[i], points[i+1], points[min(len(points)-1, i+2)]
        d += f' C {p1[0]+(p2[0]-p0[0])/6:.2f} {p1[1]+(p2[1]-p0[1])/6:.2f} {p2[0]-(p3[0]-p1[0])/6:.2f} {p2[1]-(p3[1]-p1[1])/6:.2f} {p2[0]:.2f} {p2[1]:.2f}'
    svg_path.set('d', d)
    row = index / (len(paths)-1)
    svg_path.set('style', f'--wave-dark:hsl(calc(var(--hue,160) + {row*22-11}) 78% {70+row*12}%);--wave-light:hsl(calc(var(--hue,160) + {row*22-11}) 40% {37+row*9}%)')
page = re.sub(r'(<div class="art" id="art"[^>]*>).*?</div>', lambda m: m[1] + ET.tostring(svg, encoding='unicode') + '</div>', page, flags=re.S)
for filename in ('wave.js', 'draft.js', 'draft.css'):
    digest = hashlib.sha256((path.parent / filename).read_bytes()).hexdigest()[:12]
    page = re.sub(r'\./' + re.escape(filename) + r'(?:\?v=[^"\s]+)?', './' + filename + '?v=' + digest, page)
path.write_text(page)
print(f'Updated draft: {len(projects)} research entries, {len(experience)} positions, {len(education)} education entries.')
