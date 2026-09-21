const art = document.querySelector('#art');
const pauseButton = document.querySelector('#pause');
const originalButton = document.querySelector('#original');
const mouseButton = document.querySelector('#mouse');
const speedInput = document.querySelector('#speed');
const intensityInput = document.querySelector('#intensity');
const status = document.querySelector('#status');
const performanceLabel = document.querySelector('#performance');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

try {
  const response = await fetch(new URL('./shape.svg', import.meta.url));
  if (!response.ok) throw new Error('Shape could not be loaded');
  const documentSvg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
  if (documentSvg.querySelector('parsererror')) throw new Error('Invalid shape');
  const modelResponse = await fetch(new URL('./wave-model.json', import.meta.url));
  if (!modelResponse.ok) throw new Error('Wave model could not be loaded');
  const models = await modelResponse.json();
  const svg = document.importNode(documentSvg.documentElement, true);
  // Give the original geometry room to move without clipping its outer lines.
  svg.setAttribute('viewBox', '-20 -22 336 347');
  svg.setAttribute('aria-hidden', 'true');
  art.replaceChildren(svg);

  // Preserve the export for comparison; animate a continuous model of its waves.
  const paths = [...svg.querySelectorAll('path')];
  // A continuous pastel spectrum: seafoam, periwinkle, lilac, rose, peach.
  // Colors are set once, keeping color work out of the animation loop.
  const darkPalette = [[139, 242, 210], [148, 199, 255], [195, 172, 255], [246, 173, 225], [255, 203, 167]];
  const lightPalette = [[49, 137, 121], [87, 133, 185], [144, 108, 187], [187, 106, 162], [192, 126, 91]];
  function lineColor(palette, row) {
    const position = row * (palette.length - 1);
    const index = Math.min(palette.length - 2, Math.floor(position));
    const mix = position - index;
    return `rgb(${palette[index].map((value, channel) => Math.round(value + (palette[index + 1][channel] - value) * mix)).join(',')})`;
  }
  const lines = paths.map((path, index) => {
    path.style.setProperty('--wave-dark', lineColor(darkPalette, index / (paths.length - 1)));
    path.style.setProperty('--wave-light', lineColor(lightPalette, index / (paths.length - 1)));
    const original = path.getAttribute('d');
    const numbers = original.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi).map(Number);
    const points = [];
    for (let i = 0; i < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]]);
    return { path, original, points, model: models[index] };
  });

  let paused = reducedMotion.matches;
  let originalVisible = false;
  let time = 0;
  let lastFrame = 0;
  let frameId = 0;
  let measurementStart = 0;
  let frames = 0;
  let updateTime = 0;
  let mouseDriven = false;
  let activity = 0;
  let impulse = 0;
  let lastPointer = null;
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
    // Compress the upper intensity range so maximum stays fluid and restrained.
    const intensity = Number(intensityInput.value) / 100;
    const amplitude = (.7 * intensity / (.4 + intensity)) * (mouseDriven ? activity : 1);
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
      if (originalVisible) {
        path.setAttribute('d', original);
        return;
      }
      const row = index / (lines.length - 1);
      const rowWaves = activeWaves.map((wave) => ({
        ...wave,
        center: wave.center + wave.bend * Math.sin(row * Math.PI + wave.phase),
        phase: wave.phase + row * wave.rowPhase,
        frequency: wave.frequency + model.frequency * .3,
      }));
      const movingPoints = points.map(([x]) => {
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
        return [x, 44 * Math.tanh(displacement * strength / 44)];
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
    frameId = 0;
    const delta = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .05) : 0;
    lastFrame = timestamp;
    if (mouseDriven) {
      impulse *= Math.exp(-delta * 2.8);
      activity += (impulse - activity) * (1 - Math.exp(-delta * (impulse > activity ? 12 : 3)));
      if (activity < .001 && impulse < .001) activity = impulse = 0;
    }
    time += delta * Number(speedInput.value) * 1.35 * (mouseDriven ? activity * 1.4 : 1);
    const start = performance.now();
    draw();
    updateTime += performance.now() - start;
    frames++;
    if (!measurementStart) measurementStart = timestamp;
    const elapsed = timestamp - measurementStart;
    if (elapsed >= 1000) {
      performanceLabel.textContent = `${Math.round((frames - 1) * 1000 / elapsed)} fps · ${(updateTime / frames).toFixed(2)} ms per update`;
      measurementStart = timestamp;
      frames = 1;
      updateTime = 0;
    }
    if (mouseDriven && activity === 0 && impulse === 0) {
      performanceLabel.textContent = 'At rest · move the mouse to animate';
      return;
    }
    frameId = requestAnimationFrame(tick);
  }

  function updatePlayback() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    lastFrame = 0;
    measurementStart = 0;
    frames = 0;
    updateTime = 0;
    performanceLabel.textContent = paused || originalVisible ? 'Animation idle' : 'Measuring playback…';
    pauseButton.textContent = paused ? 'Resume motion' : 'Stop motion';
    pauseButton.setAttribute('aria-pressed', String(paused));
    originalButton.setAttribute('aria-pressed', String(originalVisible));
    originalButton.textContent = originalVisible ? 'Return to wave' : 'Original shape';
    mouseButton.setAttribute('aria-pressed', String(mouseDriven));
    status.textContent = originalVisible ? 'Original geometry' : paused ? 'Motion stopped' : mouseDriven ? 'Motion follows mouse activity' : 'Overlapping stochastic waves';
    draw();
    if (!paused && !originalVisible && !document.hidden) frameId = requestAnimationFrame(tick);
  }

  pauseButton.addEventListener('click', () => {
    paused = !paused;
    originalVisible = false;
    updatePlayback();
  });
  originalButton.addEventListener('click', () => {
    originalVisible = !originalVisible;
    updatePlayback();
  });
  mouseButton.addEventListener('click', () => {
    mouseDriven = !mouseDriven;
    activity = impulse = mouseDriven ? .35 : 0;
    lastPointer = null;
    updatePlayback();
  });
  window.addEventListener('pointermove', (event) => {
    const now = performance.now();
    if (lastPointer && mouseDriven && !paused && !originalVisible) {
      const elapsed = Math.max(8, now - lastPointer.time);
      const distance = Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
      // Only speed contributes energy. Coordinates never locate or steer waves.
      const energy = Math.min(1, distance / elapsed * 1.4);
      impulse = Math.min(1, Math.max(impulse, energy));
      if (impulse > .001 && !frameId && !document.hidden) updatePlayback();
    }
    lastPointer = { x: event.clientX, y: event.clientY, time: now };
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { lastPointer = null; });
  speedInput.addEventListener('input', () => {
    document.querySelector('#speed-value').textContent = `${Number(speedInput.value).toFixed(1)}×`;
  });
  intensityInput.addEventListener('input', () => {
    document.querySelector('#intensity-value').textContent = `${intensityInput.value}%`;
    draw();
  });
  reducedMotion.addEventListener('change', () => { paused = reducedMotion.matches; updatePlayback(); });
  document.addEventListener('visibilitychange', updatePlayback);
  updatePlayback();
} catch (error) {
  status.textContent = 'Showing the static shape. Reload to retry the animation.';
  [pauseButton, mouseButton, originalButton, speedInput, intensityInput].forEach((control) => { control.disabled = true; });
  console.error(error);
}
