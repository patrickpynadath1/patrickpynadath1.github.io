const art = document.querySelector('#art');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

try {
  // The server-rendered SVG is both the static fallback and the first frame.
  const svg = art.querySelector('svg');
  const paths = [...svg.querySelectorAll('path')];
  const lines = paths.map(path => ({
    path,
    original: path.getAttribute('d'),
    points: JSON.parse(path.dataset.points),
    model: { frequency: Number(path.dataset.frequency) },
  }));

  function colorSection() {
    const hue = Number(document.documentElement.dataset.hue || 160);
    paths.forEach((path, index) => {
      const row = index / (paths.length - 1);
      path.style.setProperty('--wave-dark', `hsl(${hue + row * 22 - 11} 78% ${70 + row * 12}%)`);
      path.style.setProperty('--wave-light', `hsl(${hue + row * 22 - 11} 40% ${37 + row * 9}%)`);
    });
  }
  document.addEventListener('sectionchange', colorSection);
  colorSection();

  let time = 0;
  let lastFrame = 0;
  let frameId = 0;
  const random = (min, max) => min + Math.random() * (max - min);
  function createWave(initial = false) {
    const lifetime = random(7, 12);
    const velocity = random(18, 36) * (Math.random() < .7 ? 1 : -1);
    return {
      born: time - (initial ? random(.15, .85) * lifetime : 0),
      lifetime,
      velocity,
      // Its strongest moment can occur anywhere, keeping the field populated.
      peak: random(-130, 190),
      width: random(150, 280),
      frequency: random(.014, .029),
      phase: random(0, Math.PI * 2),
      rowPhase: random(-6, 6),
      bend: random(-30, 30),
      strength: random(26, 46),
    };
  }
  // Independent lifetimes and overlapping packets avoid a repeating global loop.
  const waves = Array.from({ length: 8 }, () => createWave(true));

  function draw() {
    // Ease away from the exact fallback geometry with zero initial velocity.
    const progress = Math.min(time / 2.4, 1);
    const blend = progress * progress * (3 - 2 * progress);
    if (blend === 0) return;
    // Compress the upper intensity range so maximum stays fluid and restrained.
    const intensity = .4;
    const amplitude = (.7 * intensity / (.4 + intensity));
    const activeWaves = waves.map((wave, index) => {
      if (time - wave.born >= wave.lifetime) wave = waves[index] = createWave();
      const age = time - wave.born;
      return {
        ...wave,
        center: wave.peak + wave.velocity * (age - wave.lifetime / 2),
        // Smooth birth/death keeps randomness fluid rather than jittery.
        gain: Math.sin(Math.PI * age / wave.lifetime) ** 2 * wave.strength,
      };
    });
    lines.forEach(({ path, original, points, model }, index) => {
      const row = index / (lines.length - 1);
      const rowWaves = activeWaves.map((wave) => ({
        ...wave,
        center: wave.center + wave.bend * Math.sin(row * Math.PI + wave.phase),
        phase: wave.phase + row * wave.rowPhase,
        frequency: wave.frequency + model.frequency * .3,
      }));
      const movingPoints = points.map(([x, initialY]) => {
        const u = (x + 148) / 296;
        let displacement = 0;
        for (const wave of rowWaves) {
          const distance = x - wave.center;
          const q = distance / wave.width;
          if (Math.abs(q) >= 1) continue;
          const envelope = (1 - q * q) ** 3;
          displacement += wave.gain * envelope * Math.sin(wave.frequency * distance + wave.phase);
        }
        // The resting geometry is still straight; all bends come from packets.
        // Soft limiting keeps coincident waves inside a comfortable visual range.
        const strength = amplitude * (.28 + .72 * u ** 1.2);
        const animatedY = 44 * Math.tanh(displacement * strength / 44);
        return [x, initialY + (animatedY - initialY) * blend];
      });
      // Interpolating cubic curves removes the export's angular line segments.
      const format = (value) => value.toFixed(2);
      let d = `M ${movingPoints[0].map(format).join(' ')}`;
      for (let i = 0; i < movingPoints.length - 1; i++) {
        const p0 = movingPoints[Math.max(0, i - 1)];
        const p1 = movingPoints[i];
        const p2 = movingPoints[i + 1];
        const p3 = movingPoints[Math.min(movingPoints.length - 1, i + 2)];
        d += ` C ${format(p1[0] + (p2[0] - p0[0]) / 6)} ${format(p1[1] + (p2[1] - p0[1]) / 6)} ${format(p2[0] - (p3[0] - p1[0]) / 6)} ${format(p2[1] - (p3[1] - p1[1]) / 6)} ${format(p2[0])} ${format(p2[1])}`;
      }
      path.setAttribute('d', d);
    });
  }

  function tick(timestamp) {
    const delta = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .05) : 0;
    lastFrame = timestamp;
    time += delta * .6 * 1.35;
    draw();
    frameId = requestAnimationFrame(tick);
  }
  function updatePlayback() {
    cancelAnimationFrame(frameId);
    lastFrame = 0;
    draw();
    if (!reducedMotion.matches && !document.hidden) frameId = requestAnimationFrame(tick);
  }
  reducedMotion.addEventListener('change', updatePlayback);
  document.addEventListener('visibilitychange', updatePlayback);
  updatePlayback();
} catch (error) {
  console.error(error);
}
