import { animate } from './vendor/anime.esm.min.js';
const modes = { about:160, cats:26, research:266, education:207, experience:185, contact:332 };
const tabs = [...document.querySelectorAll('[role=tab]')];
const overlay = document.querySelector('.content-overlay');
const scrollArea = document.querySelector('.panel-scroll');
const panels = [...document.querySelectorAll('.panel')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// Keep native disclosure semantics while animating the actual content height.
document.querySelectorAll('.project details').forEach(details => {
  const summary = details.querySelector('summary');
  let expansion;
  let expanded = details.open;
  summary.addEventListener('click', event => {
    event.preventDefault();
    const start = details.getBoundingClientRect().height;
    expansion?.cancel();
    expanded = !expanded;
    details.style.height = '';
    details.open = expanded;
    const end = details.getBoundingClientRect().height;
    if (reduced.matches) return;
    // Leave the content rendered throughout closing; hide it only at the end.
    details.open = true;
    details.style.height = `${start}px`;
    expansion = animate(details, {
      height: [start, end],
      duration: 380,
      ease: 'inOut(3)',
      onComplete: () => {
        details.open = expanded;
        details.style.height = '';
        expansion = null;
      },
    });
  });
});
let selected = null;
let motion;
let outgoingMotion;
function sizeViewport() {
  document.documentElement.style.setProperty('--viewport-width', `${document.documentElement.clientWidth}px`);
  document.documentElement.style.setProperty('--masthead-height', `${document.querySelector('.masthead').getBoundingClientRect().height}px`);
}
sizeViewport();
new ResizeObserver(sizeViewport).observe(document.querySelector('.masthead'));
function setPalette(id) {
  const hue = modes[id] ?? 160;
  const root = document.documentElement;
  root.dataset.hue = hue;
  root.style.setProperty('--hue', hue);
  root.style.setProperty('--accent', `hsl(${hue} ${root.dataset.theme === 'light' ? '43% 34%' : '72% 78%'})`);
  document.dispatchEvent(new Event('sectionchange'));
}
function cancelMotion() {
  motion?.cancel();
  outgoingMotion?.cancel();
  motion = null;
  outgoingMotion = null;
  overlay.style.clipPath = '';
  overlay.style.opacity = '';
  scrollArea.classList.remove('sliding');
  panels.forEach(panel => {
    panel.style.transform = '';
    panel.style.opacity = '';
    panel.removeAttribute('aria-hidden');
    panel.inert = false;
  });
}
function updateTabs(id) {
  document.body.classList.toggle('pane-open', Boolean(id));
  sizeViewport();
  tabs.forEach(tab => {
    const active = tab.dataset.section === id;
    tab.setAttribute('aria-selected', String(active));
    tab.setAttribute('aria-expanded', String(active));
    tab.tabIndex = active || (!id && tab === tabs[0]) ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  });
}
const reveal = { progress: 0 };
function setReveal(progress) {
  reveal.progress = progress;
  document.documentElement.style.setProperty('--pane-progress', String(progress));
}
function roll(opening, complete) {
  // One clock and one clipping edge drive both the glass and its content.
  motion = animate(reveal, {
    progress: opening ? 1 : 0,
    duration: (opening ? 650 : 420) * Math.abs((opening ? 1 : 0) - reveal.progress),
    ease: 'inOut(3)',
    onUpdate: () => setReveal(reveal.progress),
    onComplete: () => { motion = null; setReveal(opening ? 1 : 0); complete(); },
  });
}
function openSection(id, animated = true) {
  if (!(id in modes)) return;
  window.scrollTo({top:0,behavior:'instant'});
  const previous = selected;
  cancelMotion(); selected = id; setPalette(id); updateTabs(id);
  overlay.hidden = false; overlay.inert = true; scrollArea.scrollTop = 0;
  const show = () => { overlay.inert = false; };
  if (!animated || reduced.matches) { setReveal(1); return show(); }
  if (previous && previous !== id && reveal.progress === 1) {
    const before = document.getElementById(`panel-${previous}`);
    const after = document.getElementById(`panel-${id}`);
    const direction = Object.keys(modes).indexOf(id) > Object.keys(modes).indexOf(previous) ? 1 : -1;
    const distance = overlay.clientWidth;
    before.hidden = false;
    before.setAttribute('aria-hidden', 'true');
    before.inert = true;
    scrollArea.classList.add('sliding');
    outgoingMotion = animate(before, {
      translateX:[0,-direction * distance], opacity:[1,.2],
      duration:520, ease:'inOut(3)',
    });
    motion = animate(after, {
      translateX:[direction * distance,0], opacity:[.2,1],
      duration:520, ease:'inOut(3)',
      onComplete:() => {
        cancelMotion(); updateTabs(id); show();
      },
    });
    return;
  }
  roll(true, show);
}
function closeSection(animated = true) {
  if (!selected) return;
  cancelMotion();
  const button = tabs.find(tab => tab.dataset.section === selected);
  selected = null; history.replaceState(null, '', location.pathname); overlay.inert = true;
  const finish = () => { setReveal(0); overlay.hidden = true; updateTabs(null); button.focus({preventScroll:true}); };
  if (reduced.matches || !animated) return finish();
  roll(false, finish);
}
tabs.forEach((tab,index) => {
  tab.addEventListener('click', () => {
    if (selected === tab.dataset.section) return closeSection();
    history.replaceState(null, '', `#${tab.dataset.section}`); openSection(tab.dataset.section);
  });
  tab.addEventListener('keydown', event => {
    const positions = {ArrowRight:(index+1)%tabs.length,ArrowLeft:(index+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1};
    if (!(event.key in positions)) return;
    event.preventDefault(); tabs.forEach(t => { t.tabIndex = -1; });
    const next = tabs[positions[event.key]]; next.tabIndex = 0; next.focus();
  });
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeSection(); });
const theme = document.querySelector('#theme');
function updateTheme() {
  const label = document.documentElement.dataset.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  theme.setAttribute('aria-label', label);
  theme.title = label;
  setPalette(selected);
}
theme.addEventListener('click', () => {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('wave-study-theme', document.documentElement.dataset.theme); } catch {}
  updateTheme();
});
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1); if(id in modes) openSection(id); else closeSection();
});
window.addEventListener('resize', () => {
  sizeViewport();
  if(motion) { cancelMotion(); if(selected) openSection(selected,false); else {setReveal(0);overlay.hidden=true;updateTabs(null);} }
});
reduced.addEventListener('change', () => { if(selected) openSection(selected,false); });
updateTheme(); updateTabs(null);
if(location.hash.slice(1) in modes) openSection(location.hash.slice(1),false);
