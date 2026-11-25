// Build step for the interactive demonstrations: copies the modules into the site and writes the gallery page.
// Called once from scripts/build-site.mjs after the documentation pages exist.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function readRegistry() {
  return JSON.parse(readFileSync(path.join(HERE, 'registry.json'), 'utf8'));
}

export function buildSims({ out, renderPage, breadcrumb, relUrl, docsBySlug, escapeHtml, fail }) {
  const registry = readRegistry();
  const target = path.join(out, 'assets', 'sims');
  mkdirSync(target, { recursive: true });
  for (const name of readdirSync(HERE)) {
    if (/^(core|loader|sim-[a-z-]+)\.js$/.test(name) || name === 'sims.css') copyFileSync(path.join(HERE, name), path.join(target, name));
  }
  for (const entry of registry) {
    if (!existsSync(path.join(HERE, `sim-${entry.id}.js`))) fail(`site-src/sims: registry lists "${entry.id}" but sim-${entry.id}.js is missing`);
  }

  const bi = (en, zh, block = false) => `<span class="bi${block ? ' bi-block' : ''}"><span class="en">${escapeHtml(en)}</span><span class="zh" lang="zh-HK">${escapeHtml(zh)}</span></span>`;
  const pageUrl = 'sims/index.html';
  const cards = registry.map((e) => `<li class="reveal"><a href="#sim-${e.id}"><span class="kind">${bi(e.kind.en, e.kind.zh)}</span><h3>${bi(e.title.en, e.title.zh)}</h3><p>${bi(e.summary.en, e.summary.zh, true)}</p></a></li>`).join('');
  const blocks = registry.map((e) => {
    const doc = docsBySlug.get(e.related);
    const link = doc ? `<p class="sim-related">${bi('Read the guide:', '閱讀指南：')} <a href="${escapeHtml(relUrl(pageUrl, doc.urlPath))}">${escapeHtml(doc.title)}</a></p>` : '';
    return `<section class="sim-block reveal" id="sim-${e.id}" aria-label="${escapeHtml(e.title.en)}"><div class="sim-slot" data-sim="${e.id}"><div class="sim-fallback"><p><strong>${bi(e.title.en, e.title.zh)}</strong></p><p>${bi(e.summary.en, e.summary.zh)}</p><p class="muted small">${bi('Interactive demonstration, not your router. It needs JavaScript.', '互動示範，並非你嘅路由器，需要 JavaScript。')}</p></div></div>${link}</section>`;
  }).join('');
  const body = `<div class="sims-hero reveal"><div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>${breadcrumb([{ href: relUrl(pageUrl, 'index.html'), label: bi('Home', '首頁') }, { label: bi('Demonstrations', '互動示範') }])}<h1>${bi('Try it before you trust it', '先試過，再信任')}</h1><p class="lead">${bi('Twelve small, honest simulations of how a router behaves. Every one is a demonstration with made-up data, never a view of your own router, and every one works with the keyboard.', '十二個細而誠實嘅路由器行為模擬。每一個都用虛構數據示範，唔會顯示你自己嘅路由器，而且都可以用鍵盤操作。', true)}</p><p class="sims-count"><b data-count="${registry.length}">${registry.length}</b> <span>${bi('interactive demonstrations', '個互動示範')}</span></p></div><ul class="sims-grid">${cards}</ul>${blocks}`;
  renderPage({
    pageUrl, title: 'Demonstrations | Material Asus Router',
    description: 'Twelve interactive demonstrations of change guards, mesh maps, Wi-Fi channels, DHCP, port forwarding, firewalls, traffic priority, VPN routing, schedules, subnets, DNS and one-click modes.',
    page: 'sims', body, extraScripts: '<script type="module" src="../assets/sims/loader.js"></script>',
  });
}
