// A small, dependency-free Markdown renderer for the documentation site.
// Supports front matter, headings with anchors, paragraphs, nested lists, task lists, tables,
// fenced code, block quotes with callouts, images, links and inline emphasis. Raw HTML is escaped.

export function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function parseFrontMatter(source) {
  const text = source.replace(/^﻿/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { data: {}, body: text };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!pair) continue;
    let value = pair[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    data[pair[1]] = value;
  }
  return { data, body: text.slice(match[0].length) };
}

export function slugify(text) {
  const base = String(text).toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
  return base || 'section';
}

export function stripInline(text) {
  return String(text)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, a, b) => b || a)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '');
}

function inlineRender(text, ctx) {
  const stash = [];
  const keep = (html) => { stash.push(html); return `\u0001${stash.length - 1}\u0001`; };
  let out = text.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m, ticks, code) => keep(`<code>${escapeHtml(code.trim())}</code>`));
  out = escapeHtml(out);
  const emphasis = (s) => s
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w*])__([^_]+?)__(?![\w])/g, '$1<strong>$2</strong>')
    .replace(/\*([^*\s][^*]*?)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_([^_\s][^_]*?)_(?![\w])/g, '$1<em>$2</em>');
  const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*?)&quot;)?\)/g, (m, alt, src, title) =>
    keep(ctx.image(unescape(src), unescape(alt), title ? unescape(title) : '')));
  out = out.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, target, label) => {
    const hit = ctx.wikiLink(unescape(target).trim());
    return keep(`<a href="${escapeHtml(hit.href)}">${label ? emphasis(label) : escapeHtml(hit.title)}</a>`);
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*?)&quot;)?\)/g, (m, label, href, title) => {
    const hit = ctx.link(unescape(href));
    const attrs = hit.external ? ' rel="noopener noreferrer" class="ext"' : '';
    const titleAttr = title ? ` title="${escapeHtml(unescape(title))}"` : '';
    return keep(`<a href="${escapeHtml(hit.href)}"${attrs}${titleAttr}>${emphasis(label)}</a>`);
  });
  out = out.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (m, url) => keep(`<a href="${escapeHtml(unescape(url))}" rel="noopener noreferrer" class="ext">${url}</a>`));
  out = emphasis(out).replace(/ {2,}\n/g, '<br>\n');
  let guard = 0;
  while (/\u0001\d+\u0001/.test(out) && guard++ < 6) out = out.replace(/\u0001(\d+)\u0001/g, (m, i) => stash[Number(i)]);
  return out;
}

const CALLOUTS = { NOTE: ['note', 'Note'], TIP: ['tip', 'Tip'], WARNING: ['warning', 'Warning'], IMPORTANT: ['important', 'Important'], CAUTION: ['warning', 'Caution'], EXAMPLE: ['example', 'Example'] };

export function renderMarkdown(source, ctx) {
  const headings = [];
  const used = new Map();
  const idPrefix = ctx.idPrefix || '';
  const makeId = (text) => {
    const base = idPrefix + slugify(stripInline(text));
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  };
  const text = [];
  const inl = (s) => inlineRender(s, ctx);

  function parse(lines) {
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }
      const fence = /^(\s*)(`{3,}|~{3,})\s*([\w+-]*)\s*(.*)$/.exec(line);
      if (fence) {
        const closer = new RegExp(`^\\s*${fence[2][0]}{${fence[2].length},}\\s*$`);
        const body = [];
        i++;
        while (i < lines.length && !closer.test(lines[i])) { body.push(lines[i].slice(Math.min(fence[1].length, (/^\s*/.exec(lines[i])[0]).length))); i++; }
        i++;
        const lang = fence[3] || 'text';
        const code = body.join('\n');
        text.push(code);
        out.push(`<figure class="code" data-lang="${escapeHtml(lang)}"><figcaption><span>${escapeHtml(lang)}</span><button type="button" class="copy" data-copy-code>Copy</button></figcaption><pre><code>${escapeHtml(code)}</code></pre></figure>`);
        continue;
      }
      const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
      if (heading) {
        const level = heading[1].length;
        const id = makeId(heading[2]);
        headings.push({ level, text: stripInline(heading[2]), id });
        text.push(stripInline(heading[2]));
        out.push(`<h${level} id="${escapeHtml(id)}"><a class="anchor" href="#${escapeHtml(id)}" aria-label="Link to this section">#</a>${inl(heading[2])}</h${level}>`);
        i++;
        continue;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
      if (/^\s*>/.test(line)) {
        const body = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { body.push(lines[i].replace(/^\s*> ?/, '')); i++; }
        const callout = /^\[!(\w+)\]\s*(.*)$/.exec(body[0] || '');
        if (callout && CALLOUTS[callout[1].toUpperCase()]) {
          const [kind, label] = CALLOUTS[callout[1].toUpperCase()];
          const rest = callout[2] ? [callout[2], ...body.slice(1)] : body.slice(1);
          out.push(`<aside class="callout ${kind}" data-kind="${kind}"><p class="callout-title">${label}</p>${parse(rest).join('\n')}</aside>`);
        } else {
          out.push(`<blockquote>${parse(body).join('\n')}</blockquote>`);
        }
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        const cells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
        const head = cells(line);
        const aligns = cells(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : ''));
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        const td = (tag, c, n) => `<${tag}${aligns[n] ? ` style="text-align:${aligns[n]}"` : ''}>${inl(c)}</${tag}>`;
        for (const c of head) text.push(stripInline(c));
        for (const r of rows) for (const c of r) text.push(stripInline(c));
        out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c, n) => td('th', c, n)).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, n) => td('td', c, n)).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }
      const listStart = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
      if (listStart) {
        const baseIndent = listStart[1].length;
        const ordered = /\d/.test(listStart[2]);
        const items = [];
        while (i < lines.length) {
          const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
          if (m && m[1].length === baseIndent && (/\d/.test(m[2]) === ordered)) {
            const item = [m[3]];
            i++;
            while (i < lines.length) {
              const next = lines[i];
              if (/^\s*$/.test(next)) {
                const after = lines.slice(i + 1).find((l) => !/^\s*$/.test(l));
                if (after !== undefined && /^\s+\S/.test(after) && (/^(\s*)/.exec(after)[1].length > baseIndent)) { item.push(''); i++; continue; }
                break;
              }
              const indent = /^(\s*)/.exec(next)[1].length;
              if (indent > baseIndent) { item.push(next.slice(Math.min(indent, baseIndent + 2 + (ordered ? 1 : 0)))); i++; continue; }
              if (indent === baseIndent && !/^([-*+]|\d+[.)])\s+/.test(next.trim()) && !/^\s*(`{3,}|#{1,6}\s|>)/.test(next)) { item.push(next.trim()); i++; continue; }
              break;
            }
            items.push(item);
          } else break;
        }
        const tag = ordered ? 'ol' : 'ul';
        const rendered = items.map((item) => {
          let first = item[0];
          let task = '';
          const box = /^\[( |x|X)\]\s+(.*)$/.exec(first);
          if (box) { task = `<input type="checkbox" disabled${box[1] !== ' ' ? ' checked' : ''}> `; first = box[2]; }
          const inner = parse([first, ...item.slice(1)]);
          let html = inner.join('\n');
          if (inner.length && inner[0].startsWith('<p>') && !item.includes('')) html = html.replace(/^<p>([\s\S]*?)<\/p>/, '$1');
          return `<li${task ? ' class="task"' : ''}>${task}${html}</li>`;
        });
        out.push(`<${tag}>${rendered.join('')}</${tag}>`);
        continue;
      }
      const para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*(`{3,}|~{3,}|#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\|.*\|\s*$)/.test(lines[i])) { para.push(lines[i]); i++; }
      if (!para.length) { para.push(lines[i]); i++; }
      const joined = para.join('\n');
      text.push(stripInline(joined));
      out.push(`<p>${inl(joined)}</p>`.replace(/^<p>(<figure class="shot[\s\S]*<\/figure>)<\/p>$/, '$1'));
    }
    return out;
  }

  const html = parse(source.replace(/\r\n?/g, '\n').split('\n')).join('\n');
  return { html, headings, text: text.join('\n').replace(/\n{2,}/g, '\n').trim() };
}
