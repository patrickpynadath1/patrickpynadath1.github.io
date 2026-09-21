"""Bake a periodic 24-second wave field; run sync-home-draft.py afterwards."""
import json, math, random, re, struct
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parents[1]
rng = random.Random(417)
PERIOD, FPS = 24, 15
paths = list(ET.parse(ROOT / 'public/wave-study/shape.svg').getroot().iter('{http://www.w3.org/2000/svg}path'))
xs = [[float(n) for n in re.findall(r'[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?', p.get('d'), re.I)][::2] for p in paths]
models = json.loads((ROOT / 'public/wave-study/wave-model.json').read_text())
packets = [dict(period=rng.choice([8,12,24]), offset=rng.uniform(0,24), velocity=rng.uniform(18,36)*rng.choice([1,1,-1]), peak=rng.uniform(-130,190), width=rng.uniform(150,280), frequency=rng.uniform(.014,.029), phase=rng.uniform(0,math.tau), row_phase=rng.uniform(-6,6), bend=rng.uniform(-30,30), strength=rng.uniform(26,46)) for _ in range(8)]
def frame(t):
    result = []
    for row, points in enumerate(xs):
        r = row / (len(xs)-1)
        waves = []
        for p in packets:
            age = (t+p['offset']) % p['period']
            waves.append((p['peak']+p['velocity']*(age-p['period']/2)+p['bend']*math.sin(r*math.pi+p['phase']), p['width'], p['frequency']+models[row]['frequency']*.3, p['phase']+r*p['row_phase'], math.sin(math.pi*age/p['period'])**2*p['strength']))
        for x in points:
            displacement = 0
            for center,width,freq,phase,gain in waves:
                distance=x-center
                q=distance/width
                if abs(q)<1:
                    displacement += gain*(1-q*q)**3*math.sin(freq*distance+phase)
            strength=.35*(.28+.72*((x+148)/296)**1.2)
            result.append(round(4400*math.tanh(displacement*strength/44)))
    return result
assert frame(0)==frame(PERIOD)
values = [v for i in range(PERIOD*FPS) for v in frame(i/FPS)]
output = ROOT / 'public/home-draft/wave-loop.bin'
output.write_bytes(struct.pack('<'+'h'*len(values), *values))
print(f'{PERIOD}s / {PERIOD*FPS} frames / {output.stat().st_size:,} bytes; loop endpoints match exactly')
