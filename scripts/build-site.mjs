#!/usr/bin/env node
// Builds the documentation site into a static folder suitable for GitHub Pages.
//   node scripts/build-site.mjs [outDir]        (default: site)
// Reads docs/articles/**/*.md, docs/wiki/*.md, site-src/**, evidence/manifest.json and package.json.
// Environment: GITHUB_TOKEN (optional) lets the build read the latest release for site/release.json.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, parseFrontMatter, renderMarkdown, stripInline } from './markdown.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'site-src');
const OUT = path.resolve(process.cwd(), process.argv[2] || 'site');
const REPO = 'https://github.com/Ding-Ding-Projects/material-asus-router';
const REPO_API = 'Ding-Ding-Projects/material-asus-router';
const SITE_URL = 'https://ding-ding-projects.github.io/material-asus-router/';
const STATUSES = ['ready', 'in-progress'];

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const posix = (p) => p.split(path.sep).join('/');
const stripTags = (s) => String(s).replace(/<[^>]*>/g, '');

const pkg = readJson(path.join(ROOT, 'package.json'));
const i18n = readJson(path.join(SRC, 'i18n.json'));
const CATEGORIES = readJson(path.join(SRC, 'categories.json'));
const FEATURES = readJson(path.join(SRC, 'features.json'));
const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));

// ---------- bilingual helpers ----------
function entry(key) {
  const hit = i18n[key];
  if (!hit || typeof hit.en !== 'string' || typeof hit.zh !== 'string') { fail(`Missing UI string: ${key}`); return { en: key, zh: key }; }
  return hit;
}
const bi = (en, zh, block = false) => `<span class="bi${block ? ' bi-block' : ''}"><span class="en">${en}</span><span class="zh" lang="zh-HK">${zh}</span></span>`;
const t = (key, block = false) => { const e = entry(key); return bi(e.en, e.zh, block); };
const biText = (obj, block = false) => bi(escapeHtml(obj.en), escapeHtml(obj.zh), block);

// ---------- git and release provenance ----------
function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : '';
}
const commitDate = git(['log', '-1', '--format=%cI']);
const commitShort = git(['log', '-1', '--format=%h']);
const updatedIso = commitDate || new Date().toISOString();
const updatedText = `${new Date(updatedIso).toISOString().slice(0, 16).replace('T', ' ')} UTC${commitDate ? '' : ' (build time)'}`;

async function readRelease() {
  const fixture = process.env.MAR_RELEASE_FIXTURE;
  if (fixture && existsSync(fixture)) return readJson(fixture);
  const base = { verified: false, checkedAt: new Date().toISOString(), repo: REPO, releasesUrl: `${REPO}/releases` };
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ...base, reason: 'not-checked' };
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO_API}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'material-asus-router-site-build', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 404) return { ...base, reason: 'no-release' };
    if (!response.ok) return { ...base, reason: 'unavailable' };
    const release = await response.json();
    const assets = (release.assets || []).map((a) => ({
      name: String(a.name), size: Number(a.size) || 0, url: String(a.browser_download_url),
      sha256: typeof a.digest === 'string' && a.digest.startsWith('sha256:') ? a.digest.slice(7) : '',
    }));
    const verified = release.draft === false && release.prerelease === false && assets.length > 0;
    return {
      ...base, verified, reason: verified ? 'ok' : 'incomplete', tag: String(release.tag_name || ''), name: String(release.name || release.tag_name || ''),
      publishedAt: String(release.published_at || ''), url: String(release.html_url || base.releasesUrl), assets: verified ? assets : [],
    };
  } catch {
    return { ...base, reason: 'unavailable' };
  }
}

// ---------- documents ----------
function walk(dir, filter) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) found.push(...walk(full, filter));
    else if (filter(name)) found.push(full);
  }
  return found;
}

const docs = [];                 // { kind, slug, id, rel, file, title, category, order, summary, status, related, urlPath, zh }
const docsByRel = new Map();     // repo-relative posix path of the English file -> doc
const docsBySlug = new Map();    // slug -> doc

// The page title comes from front matter, so a leading level-1 heading in the body would repeat it.
const dropTitleHeading = (body) => body.replace(/^\s*#[ \t]+[^\n]*\n?/, '');

function loadDoc(kind, file) {
  const rel = posix(path.relative(ROOT, file));
  const { data, body } = parseFrontMatter(readFileSync(file, 'utf8'));
  const base = kind === 'article' ? posix(path.relative(path.join(ROOT, 'docs', 'articles'), file)).replace(/\.md$/, '') : posix(path.relative(path.join(ROOT, 'docs', 'wiki'), file)).replace(/\.md$/, '');
  const slug = kind === 'article' ? base : `wiki:${base}`;
  const doc = {
    kind, slug, rel, file, body: dropTitleHeading(body), base,
    id: (kind === 'article' ? 'a-' : 'w-') + base.replace(/[^a-z0-9]+/gi, '-'),
    title: data.title || '', category: kind === 'article' ? data.category || '' : 'wiki',
    order: Number(data.order), summary: data.summary || '', status: data.status || (kind === 'wiki' ? 'ready' : ''),
    related: (data.related || '').split(',').map((s) => s.trim()).filter(Boolean),
    urlPath: kind === 'article' ? `articles/${base}.html` : `wiki/${base}.html`,
  };
  const problems = [];
  if (!doc.title) problems.push('title');
  if (!Number.isFinite(doc.order)) problems.push('order (a number)');
  if (!doc.summary) problems.push('summary');
  if (kind === 'article') {
    if (!categoryById.has(doc.category)) problems.push(`category (one of ${CATEGORIES.map((c) => c.id).join(', ')})`);
    if (!STATUSES.includes(doc.status)) problems.push('status (ready or in-progress)');
    const folder = base.split('/')[0];
    if (!base.includes('/')) problems.push('a category folder: articles must live in docs/articles/<category>/');
    else if (categoryById.has(doc.category) && folder !== doc.category) problems.push(`category "${doc.category}" to match the folder "${folder}"`);
  }
  if (problems.length) fail(`${rel}: front matter needs ${problems.join(', ')}`);
  const twinFile = file.replace(/\.md$/, '.zh-HK.md');
  if (existsSync(twinFile)) {
    const twin = parseFrontMatter(readFileSync(twinFile, 'utf8'));
    doc.zh = { file: twinFile, rel: posix(path.relative(ROOT, twinFile)), body: dropTitleHeading(twin.body), title: twin.data.title || doc.title, summary: twin.data.summary || doc.summary };
    if (!twin.data.title) warn(`${doc.zh.rel}: no title in the Cantonese twin; the English title is used`);
  }
  docs.push(doc);
  docsByRel.set(rel, doc);
  if (docsBySlug.has(slug)) fail(`Duplicate slug ${slug}`);
  docsBySlug.set(slug, doc);
}

for (const f of walk(path.join(ROOT, 'docs', 'articles'), (n) => n.endsWith('.md') && !n.endsWith('.zh-HK.md'))) loadDoc('article', f);
for (const f of walk(path.join(ROOT, 'docs', 'wiki'), (n) => n.endsWith('.md') && !n.endsWith('.zh-HK.md'))) loadDoc('wiki', f);

const articles = docs.filter((d) => d.kind === 'article');
const wikiDocs = docs.filter((d) => d.kind === 'wiki');
const byOrder = (a, b) => a.order - b.order || a.title.localeCompare(b.title);
const inCategory = (id) => articles.filter((d) => d.category === id).sort(byOrder);
wikiDocs.sort(byOrder);

// ---------- evidence ----------
let captures = [];
const evidenceManifestPath = path.join(ROOT, 'evidence', 'manifest.json');
if (existsSync(evidenceManifestPath)) {
  try {
    const manifest = readJson(evidenceManifestPath);
    for (const c of manifest.captures || []) {
      const file = posix(String(c.file || '')).replace(/^\.\//, '');
      if (!file.startsWith('evidence/') || file.includes('..')) { fail(`evidence/manifest.json: "${c.file}" must be a path under evidence/`); continue; }
      if (!existsSync(path.join(ROOT, file))) { warn(`evidence/manifest.json lists a missing file: ${file}`); continue; }
      if (!c.alt) { fail(`evidence/manifest.json: ${file} needs alt text`); continue; }
      captures.push({ file, alt: String(c.alt), caption: String(c.caption || ''), state: String(c.state || ''), commit: String(c.commit || '') });
    }
  } catch (error) { fail(`evidence/manifest.json is not valid JSON: ${error.message}`); }
}
const captureByFile = new Map(captures.map((c) => [c.file, c]));

// ---------- link, image and render contexts ----------
const relUrl = (fromPage, toPage) => { const r = path.posix.relative(path.posix.dirname(fromPage), toPage); return r || path.posix.basename(toPage); };
const rootPrefix = (page) => '../'.repeat(page.split('/').length - 1);

function makeContext(doc, bodyFile, idPrefix, pageUrl) {
  const dir = path.posix.dirname(posix(path.relative(ROOT, bodyFile)));
  const where = posix(path.relative(ROOT, bodyFile));
  const link = (href) => {
    if (/^(https?:|mailto:)/i.test(href)) return { href, external: true };
    if (href.startsWith('#')) return { href, external: false };
    const [pathPart, hash] = href.split('#');
    const target = path.posix.normalize(path.posix.join(dir, pathPart));
    const key = target.replace(/\.zh-HK\.md$/, '.md');
    const hit = docsByRel.get(key);
    if (hit) return { href: relUrl(pageUrl, hit.urlPath) + (hash ? `#${hash}` : ''), external: false };
    if (/\.md$/.test(key) && key.startsWith('docs/')) {
      if (existsSync(path.join(ROOT, key))) return { href: `${REPO}/blob/main/${key}${hash ? `#${hash}` : ''}`, external: true };
      fail(`${where}: broken link "${href}"`);
      return { href: '#', external: false };
    }
    if (target.startsWith('..')) { fail(`${where}: link "${href}" leaves the repository`); return { href: '#', external: false }; }
    if (existsSync(path.join(ROOT, target))) return { href: `${REPO}/blob/main/${target}`, external: true };
    fail(`${where}: broken link "${href}"`);
    return { href: '#', external: false };
  };
  const wikiLink = (target) => {
    const hit = docsBySlug.get(target);
    if (!hit) { fail(`${where}: [[${target}]] does not match any article or wiki page`); return { href: '#', title: target }; }
    return { href: relUrl(pageUrl, hit.urlPath), title: hit.title };
  };
  const image = (src, alt, title) => {
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) { fail(`${where}: remote or inline images are not allowed ("${src}")`); return ''; }
    if (!alt) fail(`${where}: image "${src}" needs alt text`);
    const target = path.posix.normalize(path.posix.join(dir, src.split('#')[0]));
    const capture = captureByFile.get(target);
    if (!capture) {
      warn(`${where}: image "${src}" is not listed in evidence/manifest.json, so a placeholder is shown`);
      return `<figure class="shot missing"><div class="shot-missing">${t('shots.placeholder')}</div><figcaption>${escapeHtml(alt)}</figcaption></figure>`;
    }
    const url = relUrl(pageUrl, capture.file);
    const caption = capture.caption || title || alt;
    return `<figure class="shot"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt || capture.alt)}" loading="lazy"><figcaption>${escapeHtml(caption)}${capture.state ? ` <span class="muted">(${escapeHtml(capture.state)})</span>` : ''}</figcaption></figure>`;
  };
  return { link, wikiLink, image, idPrefix };
}

for (const doc of docs) {
  const mainCtx = makeContext(doc, doc.file, '', doc.urlPath);
  doc.html = renderMarkdown(doc.body, mainCtx);
  if (doc.zh) {
    doc.zh.html = renderMarkdown(doc.zh.body, makeContext(doc, doc.zh.file, 'zh-', doc.urlPath));
  }
}
for (const doc of docs) {
  for (const slug of doc.related) if (!docsBySlug.has(slug)) fail(`${doc.rel}: related slug "${slug}" does not exist`);
}

function reportAndExitOnErrors() {
  if (!errors.length) return;
  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`
Site build failed with ${errors.length} error(s).`);
  process.exit(1);
}
reportAndExitOnErrors();

// ---------- page shell ----------
const shellTemplate = readFileSync(path.join(SRC, 'shell.html'), 'utf8');
const BODY_MARK = '\u0000BODY\u0000';

function fillStrings(template, pageUrl, vars = {}) {
  const root = rootPrefix(pageUrl);
  return template
    .replace(/\{\{(tb|t):([^}]+)\}\}/g, (m, mode, key) => t(key.trim(), mode === 'tb'))
    .replace(/\{\{en:([^}]+)\}\}/g, (m, key) => escapeHtml(stripTags(entry(key.trim()).en)))
    .replace(/\{\{href:([^}|]+)\|([^}]+)\}\}/g, (m, slug, topic) => {
      const doc = docsBySlug.get(slug.trim());
      return doc ? relUrl(pageUrl, doc.urlPath) : relUrl(pageUrl, `articles/${topic.trim()}/index.html`);
    })
    .replace(/\{\{(\w+)\}\}/g, (m, key) => (key === 'root' ? root : Object.hasOwn(vars, key) ? vars[key] : m));
}

function renderPage({ pageUrl, title, description, page, body, extraScripts = '' }) {
  const root = rootPrefix(pageUrl);
  const html = fillStrings(shellTemplate, pageUrl, {
    title: escapeHtml(title), description: escapeHtml(description), page, body: BODY_MARK, repo: REPO, version: escapeHtml(pkg.version),
    updated: escapeHtml(updatedIso), updated_text: escapeHtml(updatedText), commit: escapeHtml(commitShort || 'unknown'), extra_scripts: extraScripts,
  }).replace(BODY_MARK, () => body);
  writeOut(pageUrl, html);
  return root;
}

function writeOut(rel, content) {
  const target = path.join(OUT, rel);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function badge(status) {
  return `<span class="badge ${status}">${t(`status.${status}`)}</span>`;
}

function iconSvg(id) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#${id}"/></svg>`;
}

// ---------- listing fragments ----------
function docCard(from, doc) {
  const zhTitle = doc.zh ? doc.zh.title : doc.title;
  const zhSummary = doc.zh ? doc.zh.summary : doc.summary;
  return `<li class="doc-card reveal"><a href="${escapeHtml(relUrl(from, doc.urlPath))}"><span class="doc-card-top">${doc.kind === 'article' ? badge(doc.status) : ''}</span><h3>${bi(escapeHtml(doc.title), escapeHtml(zhTitle))}</h3><p>${bi(escapeHtml(doc.summary), escapeHtml(zhSummary), true)}</p><span class="go">${t('go')}${iconSvg('i-arrow')}</span></a></li>`;
}

function featureHtml(from) {
  let ready = 0; let progress = 0;
  const groups = FEATURES.groups.map((group) => {
    const items = group.items.map((item) => {
      const doc = item.article ? docsBySlug.get(item.article) : null;
      const status = doc && doc.status ? doc.status : item.status;
      if (status === 'ready') ready++; else progress++;
      const missing = status === 'ready' ? '' : `<span class="f-missing">${t('features.missing')} ${biText(item.missing || FEATURES.defaultMissing)}</span>`;
      const merlin = item.merlin ? `<span class="badge merlin">${t('features.merlin')}</span>` : '';
      const inner = `<span class="f-top"><span class="f-title">${biText(item.title)}</span>${badge(status)}${merlin}</span><span class="f-sum">${biText(item.summary, true)}</span>${missing}`;
      const open = doc ? `<a class="feature-link" href="${escapeHtml(relUrl(from, doc.urlPath))}">${inner}</a>` : `<div class="feature-link plain">${inner}</div>`;
      return `<li class="feature" data-status="${status}">${open}</li>`;
    }).join('');
    return `<div class="feature-group reveal"><h3>${biText(group.title)}</h3><ul class="feature-list">${items}</ul></div>`;
  }).join('');
  const summary = bi(`${ready} ready, ${progress} in progress`, `${ready} 項已完成，${progress} 項開發中`);
  return { html: `<div class="feature-groups" id="feature-groups">${groups}</div>`, summary };
}

function downloadsHtml(release) {
  if (release.verified) {
    const date = release.publishedAt ? release.publishedAt.slice(0, 10) : '';
    const rows = release.assets.map((a) => `<li class="asset"><div class="asset-main"><strong>${escapeHtml(a.name)}</strong><span class="muted">${(a.size / 1048576).toFixed(1)} MB</span></div><div class="asset-hash">${a.sha256 ? `<span class="muted">SHA-256</span> <code>${escapeHtml(a.sha256)}</code>` : `<span class="muted">${t('download.nohash')}</span>`}</div><a class="filled-btn" href="${escapeHtml(a.url)}" rel="noopener noreferrer">${iconSvg('i-download')}${t('download.get')}</a></li>`).join('');
    return `<div class="download-card ok reveal"><div class="dl-head"><span class="badge ready">${t('download.verified')}</span><h3>${escapeHtml(release.name || release.tag)}</h3><p class="muted">${escapeHtml(release.tag)}${date ? ` &middot; ${escapeHtml(date)}` : ''}</p></div><ul class="assets">${rows}</ul><p class="muted small">${t('download.how', true)} <a href="${escapeHtml(release.url)}" rel="noopener noreferrer">${t('download.notes')}</a></p></div>`;
  }
  const reasonKey = { 'no-release': 'download.none', 'not-checked': 'download.notchecked', unavailable: 'download.unavailable', incomplete: 'download.incomplete' }[release.reason] || 'download.none';
  return `<div class="download-card empty reveal"><div class="dl-head"><span class="badge in-progress">${t('download.unverified')}</span><h3>${t('download.empty.title')}</h3></div><p>${t(reasonKey, true)}</p><p class="muted">${t('download.alt', true)}</p><div class="btn-row"><a class="tonal-btn" href="#install">${t('download.alt.cta')}</a><a class="text-btn" href="${escapeHtml(release.releasesUrl)}" rel="noopener noreferrer">${t('download.releases')}</a></div></div>`;
}

function screenshotsHtml(from) {
  if (!captures.length) return `<div class="shots-empty reveal">${iconSvg('i-image')}<p>${t('shots.empty')}</p></div>`;
  return `<div class="shots-grid">${captures.map((c) => `<figure class="shot reveal"><img src="${escapeHtml(relUrl(from, c.file))}" alt="${escapeHtml(c.alt)}" loading="lazy"><figcaption>${escapeHtml(c.caption || c.alt)}${c.state ? ` <span class="muted">(${escapeHtml(c.state)})</span>` : ''}${c.commit ? ` <code>${escapeHtml(c.commit)}</code>` : ''}</figcaption></figure>`).join('')}</div>`;
}

// ---------- pages ----------
function buildHome(release) {
  const pageUrl = 'index.html';
  const features = featureHtml(pageUrl);
  const body = fillStrings(readFileSync(path.join(SRC, 'home.html'), 'utf8'), pageUrl, {
    features: features.html, status_summary: features.summary, downloads: downloadsHtml(release), screenshots: screenshotsHtml(pageUrl),
  });
  renderPage({ pageUrl, title: 'Material Asus Router', description: 'Manage an Asus router from a readable, safe, self-hosted web app: previews, a connection-loss guard and one-click undo.', page: 'home', body, extraScripts: '<script src="assets/home.js" defer></script>' });
}

function breadcrumb(items) {
  return `<nav class="breadcrumb" aria-label="${escapeHtml(entry('nav.breadcrumb').en)}" data-i18n-attr="aria-label:nav.breadcrumb"><ol>${items.map((i, n) => `<li>${i.href ? `<a href="${escapeHtml(i.href)}">${i.label}</a>` : `<span aria-current="page">${i.label}</span>`}</li>`).join('')}</ol></nav>`;
}

function buildArticlesIndex() {
  const pageUrl = 'articles/index.html';
  const cards = CATEGORIES.map((c) => {
    const list = inCategory(c.id);
    return `<li class="topic-card reveal"><a href="${escapeHtml(relUrl(pageUrl, `articles/${c.id}/index.html`))}"><span class="task-icon">${iconSvg(c.icon)}</span><h3>${biText(c.title)}</h3><p>${biText(c.summary, true)}</p><span class="count">${list.length} ${t('articles.count')}</span></a></li>`;
  }).join('');
  const start = docsBySlug.get('start/welcome');
  const body = `<div class="page-head reveal">${breadcrumb([{ href: relUrl(pageUrl, 'index.html'), label: t('nav.home') }, { label: t('nav.articles') }])}<h1>${t('articles.title')}</h1><p class="lead">${t('articles.lead', true)}</p>${start ? `<a class="filled-btn" href="${escapeHtml(relUrl(pageUrl, start.urlPath))}">${t('articles.start')}${iconSvg('i-arrow')}</a>` : ''}</div><ul class="topic-grid">${cards}</ul><p class="muted small">${t('articles.wiki', true)} <a href="${escapeHtml(relUrl(pageUrl, 'wiki/index.html'))}">${t('nav.wiki')}</a></p>`;
  renderPage({ pageUrl, title: 'Guides | Material Asus Router', description: 'Guides for installing, connecting and using Material Asus Router.', page: 'articles', body });
}

function buildCategory(topic) {
  const pageUrl = `articles/${topic.id}/index.html`;
  const list = inCategory(topic.id);
  const steps = topic.steps.en.map((s, n) => `<li>${bi(escapeHtml(s), escapeHtml(topic.steps.zh[n] || s), true)}</li>`).join('');
  const cards = list.length ? list.map((d) => docCard(pageUrl, d)).join('') : `<li class="empty-note">${t('category.empty')}</li>`;
  const ready = list.filter((d) => d.status === 'ready').length;
  const body = `<div class="page-head reveal">${breadcrumb([{ href: relUrl(pageUrl, 'index.html'), label: t('nav.home') }, { href: relUrl(pageUrl, 'articles/index.html'), label: t('nav.articles') }, { label: biText(topic.title) }])}<div class="topic-title"><span class="task-icon big">${iconSvg(topic.icon)}</span><h1>${biText(topic.title)}</h1></div><p class="lead">${biText(topic.intro, true)}</p><div class="guided"><h2>${t('category.how')}</h2><ol>${steps}</ol></div><p class="muted small">${list.length} ${t('articles.count')} &middot; ${ready} ${t('status.ready')}</p></div><ul class="doc-grid">${cards}</ul>`;
  renderPage({ pageUrl, title: `${topic.title.en} | Material Asus Router`, description: topic.summary.en, page: 'articles', body });
}

function neighbours(doc, siblings) {
  const i = siblings.indexOf(doc);
  return { prev: i > 0 ? siblings[i - 1] : null, next: i >= 0 && i < siblings.length - 1 ? siblings[i + 1] : null };
}

function tocHtml(doc) {
  const makeList = (headings, idPrefix) => headings.filter((h) => h.level >= 2 && h.level <= 3).map((h) => `<li class="l${h.level}"><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`).join('');
  const en = makeList(doc.html.headings);
  const zhHeadings = doc.zh ? makeList(doc.zh.html.headings) : '';
  if (!en && !zhHeadings) return '';
  return `<nav class="toc" aria-label="${escapeHtml(entry('article.toc').en)}" data-i18n-attr="aria-label:article.toc"><p class="toc-title">${t('article.toc')}</p><div class="toc-en"><ol>${en}</ol></div>${doc.zh ? `<div class="toc-zh" lang="zh-HK"><ol>${zhHeadings}</ol></div>` : ''}</nav>`;
}

function buildDocPage(doc) {
  const pageUrl = doc.urlPath;
  const isArticle = doc.kind === 'article';
  const siblings = isArticle ? inCategory(doc.category) : wikiDocs;
  const { prev, next } = neighbours(doc, siblings);
  const topic = isArticle ? categoryById.get(doc.category) : null;
  const crumbs = isArticle
    ? [{ href: relUrl(pageUrl, 'index.html'), label: t('nav.home') }, { href: relUrl(pageUrl, 'articles/index.html'), label: t('nav.articles') }, { href: relUrl(pageUrl, `articles/${topic.id}/index.html`), label: biText(topic.title) }, { label: escapeHtml(doc.title) }]
    : [{ href: relUrl(pageUrl, 'index.html'), label: t('nav.home') }, { href: relUrl(pageUrl, 'wiki/index.html'), label: t('nav.wiki') }, { label: escapeHtml(doc.title) }];
  const related = doc.related.map((s) => docsBySlug.get(s)).filter(Boolean);
  const zhTitle = doc.zh ? doc.zh.title : doc.title;
  const zhSummary = doc.zh ? doc.zh.summary : doc.summary;
  const notice = doc.zh ? '' : `<p class="lang-notice" role="note">${t('article.nozh', true)}</p>`;
  const bodies = `<div class="prose body-en">${doc.html.html}</div>${doc.zh ? `<div class="prose body-zh" lang="zh-HK">${doc.zh.html.html}</div>` : ''}`;
  const pager = `<nav class="pager" aria-label="${escapeHtml(entry('article.pager').en)}" data-i18n-attr="aria-label:article.pager">${prev ? `<a class="pager-prev" href="${escapeHtml(relUrl(pageUrl, prev.urlPath))}"><small>${t('article.prev')}</small><span>${bi(escapeHtml(prev.title), escapeHtml(prev.zh ? prev.zh.title : prev.title))}</span></a>` : '<span></span>'}${next ? `<a class="pager-next" href="${escapeHtml(relUrl(pageUrl, next.urlPath))}"><small>${t('article.next')}</small><span>${bi(escapeHtml(next.title), escapeHtml(next.zh ? next.zh.title : next.title))}</span></a>` : '<span></span>'}</nav>`;
  const relatedHtml = related.length ? `<section class="related"><h2>${t('article.related')}</h2><ul class="doc-grid compact">${related.map((d) => docCard(pageUrl, d)).join('')}</ul></section>` : '';
  const source = `${REPO}/blob/main/${doc.rel}`;
  const body = `<div class="article-layout"><article class="article"><header class="page-head">${breadcrumb(crumbs)}<h1>${bi(escapeHtml(doc.title), escapeHtml(zhTitle))}</h1><p class="lead">${bi(escapeHtml(doc.summary), escapeHtml(zhSummary), true)}</p><div class="meta-row">${isArticle ? badge(doc.status) : `<span class="badge wiki">${t('nav.wiki')}</span>`}<a class="text-btn" href="${escapeHtml(source)}" rel="noopener noreferrer">${t('article.source')}</a>${doc.zh ? `<a class="text-btn" href="${escapeHtml(`${REPO}/blob/main/${doc.zh.rel}`)}" rel="noopener noreferrer">${t('article.source.zh')}</a>` : ''}</div>${isArticle && doc.status === 'in-progress' ? `<p class="progress-note" role="note">${iconSvg('i-timer')}<span>${t('article.inprogress', true)}</span></p>` : ''}${notice}</header>${bodies}${pager}${relatedHtml}</article><aside class="article-side"><details class="toc-wrap" open><summary>${t('article.toc')}</summary>${tocHtml(doc)}</details></aside></div>`;
  renderPage({ pageUrl, title: `${doc.title} | Material Asus Router`, description: doc.summary, page: isArticle ? 'articles' : 'wiki', body });
}

function buildWikiIndex() {
  const pageUrl = 'wiki/index.html';
  const cards = wikiDocs.length ? wikiDocs.map((d) => docCard(pageUrl, d)).join('') : `<li class="empty-note">${t('wiki.empty')}</li>`;
  const body = `<div class="page-head reveal">${breadcrumb([{ href: relUrl(pageUrl, 'index.html'), label: t('nav.home') }, { label: t('nav.wiki') }])}<h1>${t('wiki.title')}</h1><p class="lead">${t('wiki.lead', true)}</p></div><ul class="doc-grid">${cards}</ul>`;
  renderPage({ pageUrl, title: 'Wiki | Material Asus Router', description: 'Reference notes and answers for Material Asus Router.', page: 'wiki', body });
}

function build404() {
  const pageUrl = '404.html';
  const body = `<div class="page-head"><h1>${t('notfound.title')}</h1><p class="lead">${t('notfound.text', true)}</p><a class="filled-btn" href="index.html">${t('nav.home')}</a></div>`;
  renderPage({ pageUrl, title: 'Not found | Material Asus Router', description: 'Page not found.', page: 'notfound', body });
}

// ---------- search index ----------
function writeSearchIndex() {
  const cap = (s) => s.slice(0, 14000);
  const entries = [];
  for (const d of docs) {
    entries.push({
      t: d.title, z: d.zh ? d.zh.title : '', u: d.urlPath, k: d.kind, c: d.kind === 'article' ? categoryById.get(d.category).title : { en: 'Wiki', zh: '維基' },
      s: d.summary, h: d.html.headings.filter((h) => h.level >= 2).map((h) => [h.text, h.id]).slice(0, 40),
      x: cap(d.html.text), y: d.zh ? cap(d.zh.html.text) : '',
    });
  }
  const pseudo = [['demo', 'nav.demo', 'index.html#demo'], ['install', 'nav.install', 'index.html#install'], ['download', 'nav.download', 'index.html#download']];
  for (const [id, key, url] of pseudo) entries.push({ t: entry(key).en, z: entry(key).zh, u: url, k: 'page', c: { en: 'Home', zh: '首頁' }, s: '', h: [], x: '', y: '' });
  writeOut('search-index.js', `window.__SEARCH_INDEX=${JSON.stringify(entries)};`);
}

// ---------- assets ----------
function copyAssets() {
  const assets = path.join(OUT, 'assets');
  mkdirSync(path.join(assets, 'fonts'), { recursive: true });
  for (const name of ['style.css', 'app.js', 'home.js', 'favicon.svg']) copyFileSync(path.join(SRC, name), path.join(assets, name));
  const dictionary = {};
  for (const [key, value] of Object.entries(i18n)) dictionary[key] = { en: stripTags(value.en).replace(/&amp;/g, '&').replace(/&middot;/g, '·').replace(/&rarr;/g, '→'), zh: stripTags(value.zh).replace(/&amp;/g, '&').replace(/&middot;/g, '·') };
  writeFileSync(path.join(assets, 'i18n.js'), `window.__I18N=${JSON.stringify(dictionary)};`);
  const fontDir = path.join(ROOT, 'node_modules', '@fontsource-variable', 'roboto-flex', 'files');
  for (const name of ['roboto-flex-latin-wght-normal.woff2', 'roboto-flex-latin-ext-wght-normal.woff2']) {
    const from = path.join(fontDir, name);
    if (existsSync(from)) copyFileSync(from, path.join(assets, 'fonts', name)); else fail(`Font missing: ${name}. Run npm ci first.`);
  }
  for (const c of captures) {
    const to = path.join(OUT, c.file);
    mkdirSync(path.dirname(to), { recursive: true });
    copyFileSync(path.join(ROOT, c.file), to);
  }
  writeFileSync(path.join(OUT, '.nojekyll'), '');
}

// ---------- phone PDF edition ----------
function buildPdfPage() {
  const order = [];
  for (const w of wikiDocs) order.push({ section: 'Wiki', doc: w });
  const sections = [{ label: 'Wiki', docs: wikiDocs }, ...CATEGORIES.map((c) => ({ label: c.title.en, docs: inCategory(c.id) }))];
  const ids = new Map(docs.map((d) => [d.id, d]));
  const makeCtx = (doc, bodyFile, prefix) => {
    const dir = path.posix.dirname(posix(path.relative(ROOT, bodyFile)));
    return {
      idPrefix: prefix,
      link: (href) => {
        if (/^(https?:|mailto:)/i.test(href)) return { href, external: true };
        if (href.startsWith('#')) return { href: `#${prefix}${href.slice(1)}`, external: false };
        const [p, hash] = href.split('#');
        const hit = docsByRel.get(path.posix.normalize(path.posix.join(dir, p)).replace(/\.zh-HK\.md$/, '.md'));
        if (hit) return { href: `#${hit.id}${hash ? `--${hash}` : ''}`, external: false };
        return { href: `${REPO}/blob/main/${path.posix.normalize(path.posix.join(dir, p))}`, external: true };
      },
      wikiLink: (target) => { const hit = docsBySlug.get(target); return hit ? { href: `#${hit.id}`, title: hit.title } : { href: '#', title: target }; },
      image: (src, alt) => { const c = captureByFile.get(path.posix.normalize(path.posix.join(dir, src))); return c ? `<figure class="shot"><img src="${escapeHtml(c.file)}" alt="${escapeHtml(alt || c.alt)}"><figcaption>${escapeHtml(c.caption || alt)}</figcaption></figure>` : `<p class="muted">[${escapeHtml(alt)}: ${entry('shots.placeholder').en}]</p>`; },
    };
  };
  const rendered = (doc) => {
    const en = renderMarkdown(doc.body, makeCtx(doc, doc.file, `${doc.id}--`));
    const zh = doc.zh ? renderMarkdown(doc.zh.body, makeCtx(doc, doc.zh.file, `${doc.id}-zh--`)) : null;
    return { en, zh };
  };
  const toc = sections.filter((s) => s.docs.length).map((s) => `<h2 class="toc-sec">${escapeHtml(s.label)}</h2><ol class="toc-list">${s.docs.map((d) => `<li><a href="#${d.id}">${escapeHtml(d.title)}</a>${d.zh && d.zh.title !== d.title ? ` <span lang="zh-HK" class="zh-t">${escapeHtml(d.zh.title)}</span>` : ''}</li>`).join('')}</ol>`).join('');
  const parts = sections.filter((s) => s.docs.length).map((s) => `<section class="sec"><h1 class="sec-title" id="sec-${escapeHtml(s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">${escapeHtml(s.label)}</h1>${s.docs.map((d) => {
    const r = rendered(d);
    return `<article class="doc" id="${d.id}"><h2 class="doc-title">${escapeHtml(d.title)}</h2><p class="doc-sum">${escapeHtml(d.summary)}</p>${d.kind === 'article' ? `<p class="doc-status">${d.status === 'ready' ? 'Ready' : 'In progress'}</p>` : ''}<div class="prose">${r.en.html}</div>${r.zh ? `<div class="prose zh" lang="zh-HK"><h2 class="doc-title">${escapeHtml(d.zh.title)}</h2>${r.zh.html}</div>` : ''}<p class="back"><a href="#top-toc">Contents</a></p></article>`;
  }).join('')}</section>`).join('');
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Material Asus Router: phone edition</title>
<style>
@font-face{font-family:"Roboto Flex";src:url(assets/fonts/roboto-flex-latin-wght-normal.woff2) format("woff2");font-weight:100 1000;font-display:swap}
@page{size:90mm 160mm;margin:7mm 6mm}
*{box-sizing:border-box}
html{font-size:9pt}
body{margin:0;font-family:"Roboto Flex",system-ui,"PingFang HK","Microsoft JhengHei","Noto Sans CJK TC",sans-serif;line-height:1.45;color:#1b1b1f;background:#fff;overflow-wrap:anywhere}
a{color:#0b57d0;text-decoration:none}
.cover{page-break-after:always}
.cover h1{font-size:20pt;line-height:1.1;margin:30mm 0 4mm}
.cover p{margin:0 0 3mm}
.cover .meta{color:#555;font-size:8pt}
.toc-sec{font-size:11pt;margin:5mm 0 1.5mm;color:#0b57d0}
.toc-list{margin:0;padding-left:5mm}.toc-list li{margin:1mm 0}
.zh-t{color:#555;font-size:8pt}
.sec-title{font-size:16pt;page-break-before:always;margin:0 0 3mm;color:#0b57d0}
.doc{page-break-before:always}
.sec-title+.doc{page-break-before:avoid}
.doc-title{font-size:14pt;line-height:1.15;margin:0 0 2mm}
.doc-sum{color:#444;margin:0 0 2mm}.doc-status{display:inline-block;font-size:7pt;border:0.3mm solid #999;border-radius:3mm;padding:0 2mm;margin:0 0 3mm}
h1,h2,h3,h4{break-after:avoid;line-height:1.2}.prose h1{font-size:13pt}.prose h2{font-size:11.5pt;margin:4mm 0 1.5mm}.prose h3{font-size:10pt;margin:3mm 0 1mm}
.prose h1 .anchor,.prose h2 .anchor,.prose h3 .anchor,.prose h4 .anchor{display:none}
p,ul,ol{margin:0 0 2.5mm}ul,ol{padding-left:5mm}
code{font-family:"Cascadia Mono",Consolas,monospace;font-size:7.5pt;background:#f1f1f5;padding:0 .8mm;border-radius:.8mm}
pre{background:#f1f1f5;padding:2mm;border-radius:1.5mm;white-space:pre-wrap;word-break:break-all;font-size:7pt;break-inside:avoid-page}
pre code{background:none;padding:0;font-size:7pt}
figure.code{margin:0 0 3mm}figure.code figcaption{font-size:6.5pt;color:#666}.copy{display:none}
.table-wrap{overflow:visible}table{border-collapse:collapse;width:100%;font-size:7.5pt;margin:0 0 3mm}th,td{border:.2mm solid #bbb;padding:1mm 1.5mm;text-align:left;vertical-align:top}th{background:#eef}
.callout{border-left:1mm solid #0b57d0;background:#eef3fd;padding:1.5mm 2.5mm;margin:0 0 3mm;border-radius:1mm}.callout-title{font-weight:700;margin:0 0 1mm}
blockquote{margin:0 0 3mm;padding-left:3mm;border-left:.8mm solid #bbb;color:#444}
img{max-width:100%;height:auto}figure.shot{margin:0 0 3mm}figcaption{font-size:7pt;color:#555}
.prose.zh{margin-top:5mm;padding-top:3mm;border-top:.3mm dashed #aaa}
.back{font-size:7pt;margin-top:4mm}
</style></head><body id="top-toc"><section class="cover"><h1>Material Asus Router</h1><p>Phone edition: every guide and wiki page in one document. Tap an entry below to jump to it.</p><p class="meta">Version ${escapeHtml(pkg.version)} &middot; ${escapeHtml(updatedText)}<br>${SITE_URL}</p>${toc}</section>${parts}</body></html>`;
  writeOut('material-asus-router.pdf.html', page);
}

// ---------- run ----------
function sanityCheck() {
  for (const file of walk(OUT, (n) => n.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    const dir = path.dirname(file);
    for (const m of html.matchAll(/(?:href|src)="([^"#?][^"]*?)(?:#[^"]*)?"/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|data:|javascript:)/i.test(target)) continue;
      const resolved = path.resolve(dir, target);
      if (!existsSync(resolved)) { if (!/material-asus-router\.pdf$/.test(target)) fail(`${posix(path.relative(OUT, file))}: link target missing: ${target}`); }
    }
  }
}

const release = await readRelease();
mkdirSync(OUT, { recursive: true });
// Empty the folder instead of deleting it, so a server or editor that has it open keeps working.
for (const name of readdirSync(OUT)) rmSync(path.join(OUT, name), { recursive: true, force: true });
buildHome(release);
buildArticlesIndex();
for (const topic of CATEGORIES) buildCategory(topic);
for (const doc of docs) buildDocPage(doc);
buildWikiIndex();
build404();
writeSearchIndex();
buildPdfPage();
copyAssets();
writeFileSync(path.join(OUT, 'release.json'), `${JSON.stringify(release, null, 2)}\n`);
sanityCheck();

for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nSite build failed with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`Site built in ${OUT}: ${articles.length} article(s), ${wikiDocs.length} wiki page(s), ${CATEGORIES.length} categories, release ${release.verified ? release.tag : `not verified (${release.reason})`}.`);
