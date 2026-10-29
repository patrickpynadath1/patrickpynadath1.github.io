"""Add a paper to the blog bibliography from an arXiv ID or a DOI.

Fetches BibTeX (arxiv.org/bibtex for arXiv, doi.org content negotiation for DOIs),
skips papers already in the file, appends the entry, and copies "[@key]" to the
clipboard so it can be pasted straight into a post.

Usage:  python3 scripts/add_citation.py 2310.16834
        python3 scripts/add_citation.py https://arxiv.org/abs/2310.16834
        python3 scripts/add_citation.py 10.48550/arXiv.2107.03006
"""
import re, subprocess, sys, urllib.request, pathlib

BIB = pathlib.Path(__file__).resolve().parents[1] / 'src/content/blog/dlm_bibliography.bib'


def fetch(url, accept=None):
    req = urllib.request.Request(url, headers={'User-Agent': 'add_citation.py', **({'Accept': accept} if accept else {})})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode('utf-8').strip()


def main():
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        sys.exit('Give an arXiv ID, an arXiv link, or a DOI.')
    raw = sys.argv[1].strip()
    arxiv = re.search(r'(\d{4}\.\d{4,5})(v\d+)?', raw) if 'doi.org/10.' not in raw or 'arXiv' in raw else None
    doi = re.search(r'(10\.\d{4,9}/\S+)', raw)
    if arxiv:
        ident = arxiv.group(1)
        bib = fetch(f'https://arxiv.org/bibtex/{ident}')
    elif doi:
        ident = doi.group(1).rstrip('.,)')
        bib = fetch(f'https://doi.org/{ident}', 'application/x-bibtex')
    else:
        sys.exit(f'Could not find an arXiv ID or DOI in: {raw}')

    text = BIB.read_text()
    # Already there? Match on the arXiv ID or DOI anywhere in the file.
    for line in text.splitlines():
        if ident.lower() in line.lower():
            key = re.match(r'\s*@\w+\{([^,]+),', line)
            if key:
                return done(key.group(1), 'Already in the bibliography')
    m = re.match(r'\s*@\w+\{([^,]+),', bib)
    if not m:
        sys.exit('The response was not BibTeX:\n' + bib[:300])
    key = m.group(1).strip()
    if re.search(r'@\w+\{' + re.escape(key) + ',', text):
        key = key + 'b'
        bib = re.sub(r'(@\w+\{)[^,]+,', r'\g<1>' + key + ',', bib, count=1)
    BIB.write_text(text.rstrip('\n') + '\n' + bib + '\n')
    title = re.search(r'title\s*=\s*\{+(.*?)\}+\s*,', bib, re.S)
    done(key, 'Added' + (f': {" ".join(title.group(1).split())}' if title else ''))


def done(key, msg):
    cite = f'[@{key}]'
    try:
        subprocess.run(['pbcopy'], input=cite.encode(), check=True)
        print(f'{msg}\n{cite}  (copied, paste it into your post)')
    except Exception:
        print(f'{msg}\n{cite}')


if __name__ == '__main__':
    main()
