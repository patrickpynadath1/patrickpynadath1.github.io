import { animate } from 'animejs';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

document.querySelectorAll<HTMLDetailsElement>('.home-page details.expandable-section').forEach(panel => {
  const summary = panel.querySelector('summary');
  if (!summary) return;
  const icon = summary.querySelector<HTMLElement>('.expand-icon');
  let expanded = panel.open;
  let motion: ReturnType<typeof animate> | undefined;
  let iconMotion: ReturnType<typeof animate> | undefined;
  panel.classList.add('animated-panel');

  const finish = () => {
    motion?.cancel();
    iconMotion?.cancel();
    motion = undefined;
    iconMotion = undefined;
    panel.open = expanded;
    panel.style.removeProperty('height');
    panel.style.removeProperty('overflow');
    if (icon) icon.style.transform = `rotate(${expanded ? 180 : 0}deg)`;
  };

  summary.addEventListener('click', event => {
    if ((event.target as Element).closest('a')) return;
    event.preventDefault();
    const start = panel.getBoundingClientRect().height;
    motion?.cancel();
    iconMotion?.cancel();
    expanded = !expanded;
    if (reducedMotion.matches) {
      finish();
      return;
    }
    // Measure the natural target in either state, then keep content mounted
    // during the height animation so closing and quick reversals remain smooth.
    panel.style.removeProperty('height');
    panel.open = expanded;
    const end = panel.getBoundingClientRect().height;
    panel.open = true;
    panel.style.height = `${start}px`;
    panel.style.overflow = 'hidden';
    if (icon) iconMotion = animate(icon, { rotate: expanded ? 180 : 0, duration: 280, ease: 'out(3)' });
    motion = animate(panel, {
      height: [start, end],
      duration: 320,
      ease: 'out(3)',
      onComplete: finish,
    });
  });
  window.addEventListener('resize', () => { if (motion) finish(); }, { passive: true });
  reducedMotion.addEventListener('change', () => { if (motion) finish(); });
});
