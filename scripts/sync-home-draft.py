"""Refresh the standalone homepage draft from the website's canonical JSON data."""
import html
import hashlib
import json
from pathlib import Path
import re

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

replace_panel('about', '<h2>About me</h2>' + ''.join(f'<p class="text-block">{h(p)}</p>' for p in info['bio']))
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
experience_html = '<h2>Experience</h2>'
for item in experience:
    bullets = ''.join('<li>' + h(b) + '</li>' for b in item['bullets'])
    experience_html += f'<article class="experience-item"><span class="venue">{h(item["timeframe"])}</span><h3>{h(item["role"])}</h3><p class="organization">{h(item["organization"])}</p><ul>{bullets}</ul></article>'
if 'id="panel-experience"' not in page:
    page = page.replace('<section class="panel" role="tabpanel" id="panel-contact"', '<section class="panel" role="tabpanel" id="panel-experience" aria-labelledby="tab-experience" tabindex="0" hidden></section><section class="panel" role="tabpanel" id="panel-contact"')
replace_panel('experience', experience_html)
labels = {'about':'About me','cats':'Cats','research':'Research projects','education':'Education','experience':'Experience','contact':'Contact'}
tabs = ''.join(f'<button type="button" role="tab" id="tab-{id}" aria-controls="panel-{id}" aria-selected="false" aria-expanded="false" data-section="{id}">{label}</button>' for id, label in labels.items())
page = re.sub(r'(<nav class="tabs"[^>]*>).*?</nav>', lambda m:m[1] + tabs + '</nav>', page, flags=re.S)
if 'aria-label="Google Scholar"' not in page:
    scholar = f'<a href="{h(info["links"]["scholar"],quote=True)}" aria-label="Google Scholar" title="Google Scholar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 9 10-6 10 6-10 6z M6 12v6c4 3 8 3 12 0v-6 M22 9v8"/></svg></a>'
    page = re.sub(r'(<nav class="socials"[^>]*>.*?)(</nav>)', lambda m:m[1] + scholar + m[2], page, flags=re.S)
for filename in ('wave.js', 'draft.js', 'draft.css'):
    digest = hashlib.sha256((path.parent / filename).read_bytes()).hexdigest()[:12]
    page = re.sub(r'\./' + re.escape(filename) + r'(?:\?v=[^"\s]+)?', './' + filename + '?v=' + digest, page)
path.write_text(page)
print(f'Updated draft: {len(projects)} research entries, {len(experience)} positions, {len(education)} education entries.')
