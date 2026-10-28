"""Refresh the embedded code snippets: python3 code_refs.py <candi> > code_refs.json && python3 inject_refs.py combined.html"""
import re, sys
p = sys.argv[1]; s = open(p).read(); refs = open('code_refs.json').read().replace('</', '<\\/')
s = re.sub(r'(<script type="application/json" id="code-refs">).*?(</script>)', lambda m: m.group(1) + refs + m.group(2), s, count=1, flags=re.S)
open(p, 'w').write(s)
