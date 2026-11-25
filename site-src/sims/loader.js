// Finds every [data-sim] placeholder on the page and mounts its demonstration when it scrolls near the viewport.
import { mountSim, motionFull } from './core.js';

const base = new URL('.', import.meta.url);
if (!document.querySelector('link[data-sims-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = new URL('sims.css', base).href; link.setAttribute('data-sims-css', '');
  document.head.append(link);
}

const loaded = new Map();
async function mount(slot) {
  if (slot.dataset.simState) return;
  slot.dataset.simState = 'loading';
  const id = slot.dataset.sim;
  try {
    if (!loaded.has(id)) loaded.set(id, import(new URL(`sim-${id}.js`, base).href));
    const mod = await loaded.get(id);
    mountSim(slot, mod.default);
    slot.dataset.simState = 'ready';
    slot.classList.add('sim-ready');
  } catch (error) {
    slot.dataset.simState = 'error';
    console.error('Demonstration failed to load:', id, error);
  }
}

const slots = [...document.querySelectorAll('[data-sim]')];
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); mount(e.target); }
  }, { rootMargin: '300px' });
  slots.forEach((slot) => io.observe(slot));
} else slots.forEach(mount);

// Count-up numbers on the gallery page; shown final at once when motion is reduced.
for (const el of document.querySelectorAll('[data-count]')) {
  const end = Number(el.dataset.count);
  if (!motionFull()) { el.textContent = String(end); continue; }
  const t0 = performance.now();
  const step = (now) => { const f = Math.min(1, (now - t0) / 900); el.textContent = String(Math.round(end * (1 - Math.pow(1 - f, 3)))); if (f < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// Jump from a gallery card to its demonstration, mounting it first so the target exists.
if (location.hash.startsWith('#sim-')) {
  const slot = document.querySelector(`[data-sim="${CSS.escape(location.hash.slice(5))}"]`);
  if (slot) mount(slot).then(() => slot.scrollIntoView({ block: 'start' }));
}
