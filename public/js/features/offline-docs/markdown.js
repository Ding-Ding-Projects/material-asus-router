// A small Markdown reader for the bundled documentation. parseMarkdown turns
// text into plain data (blocks and inline pieces); the screen then builds DOM
// nodes from that data. Nothing is ever turned into an HTML string, so a page
// cannot inject markup. Links are resolved here: a relative link to another
// .md page becomes an in-app page link, [[slug]] links by name, a link to any
// other file becomes a GitHub link, and everything else is an outside link.
const REPO = "https://github.com/Ding-Ding-Projects/material-asus-router/blob/main/docs";

// Turns a link target into { page, anchor } or { href }.
export function resolveLink(target, fromSlug) {
  const t = String(target).trim();
  if (/^https?:\/\//i.test(t)) return { href: t, external: true };
  if (/^mailto:/i.test(t)) return { href: t, external: true };
  if (t.startsWith("#")) return { page: fromSlug, anchor: t.slice(1) };
  const [pathPart, anchor = ""] = t.split("#");
  if (/\.md$/.test(pathPart)) {
    const fromWiki = fromSlug.startsWith("wiki:");
    const baseParts = fromWiki ? ["wiki"] : ["articles", ...fromSlug.split("/").slice(0, -1)];
    const parts = pathPart.startsWith("/") ? [] : [...baseParts];
    for (const seg of pathPart.split("/")) {
      if (seg === "..") parts.pop();
      else if (seg && seg !== ".") parts.push(seg);
    }
    const rel = parts.join("/").replace(/\.zh-HK\.md$|\.md$/, "");
    if (rel.startsWith("articles/")) return { page: rel.slice(9), anchor };
    if (rel.startsWith("wiki/")) return { page: `wiki:${rel.slice(5)}`, anchor };
    return { href: `${REPO}/${parts.join("/")}`, external: true };
  }
  return { href: `${REPO}/${pathPart}`, external: true };
}

export function parseInline(text, fromSlug) {
  const out = [];
  let rest = String(text);
  const push = (piece) => piece && out.push(piece);
  const patterns = [
    [/`([^`]+)`/, (m) => ({ code: m[1] })],
    [/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/, (m) => ({ text: m[2] ?? m[1], link: { page: m[1].trim(), anchor: "" } })],
    [/\[([^\]]+)\]\(([^)\s]+)\)/, (m) => ({ text: m[1], link: resolveLink(m[2], fromSlug) })],
    [/\*\*([^*]+)\*\*/, (m) => ({ strong: parseInline(m[1], fromSlug) })],
    [/(?<![*\w])\*([^*\s][^*]*)\*(?!\*)/, (m) => ({ em: parseInline(m[1], fromSlug) })],
  ];
  while (rest) {
    let best = null;
    for (const [re, make] of patterns) {
      const m = re.exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { m, make };
    }
    if (!best) {
      push({ text: rest });
      break;
    }
    push(best.m.index ? { text: rest.slice(0, best.m.index) } : null);
    push(best.make(best.m));
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return out;
}

export const slugify = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");

export function parseMarkdown(markdown, fromSlug = "") {
  const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  const para = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", inline: parseInline(para.join(" "), fromSlug) });
    para.length = 0;
  };
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```\s*([\w-]*)\s*$/);
    if (fence) {
      flush();
      const code = [];
      for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++) code.push(lines[i]);
      blocks.push({ type: "code", lang: fence[1], text: code.join("\n") });
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      flush();
      blocks.push({ type: "h", level: heading[1].length, id: slugify(heading[2]), inline: parseInline(heading[2], fromSlug) });
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flush();
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    if (/^>/.test(line)) {
      flush();
      const quote = [];
      for (; i < lines.length && /^>/.test(lines[i]); i++) quote.push(lines[i].replace(/^>\s?/, ""));
      const kind = quote[0]?.match(/^\[!(\w+)\]\s*$/);
      blocks.push({ type: "quote", kind: kind ? kind[1].toLowerCase() : "", blocks: parseMarkdown(quote.slice(kind ? 1 : 0).join("\n"), fromSlug) });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      flush();
      const cells = (row) => row.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
      const head = cells(line);
      i += 2;
      const rows = [];
      for (; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) rows.push(cells(lines[i]));
      blocks.push({ type: "table", head: head.map((c) => parseInline(c, fromSlug)), rows: rows.map((r) => r.map((c) => parseInline(c, fromSlug))) });
      continue;
    }
    const item = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (item) {
      flush();
      const ordered = /\d/.test(item[2]);
      const items = [];
      for (; i < lines.length; i++) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (m) items.push(parseInline(m[3], fromSlug));
        else if (/^\s{2,}\S/.test(lines[i]) && items.length) items[items.length - 1].push(...parseInline(` ${lines[i].trim()}`, fromSlug));
        else break;
      }
      blocks.push({ type: ordered ? "ol" : "ul", items });
      continue;
    }
    if (!line.trim()) flush();
    else para.push(line.trim());
    i++;
  }
  flush();
  return blocks;
}

// Builds DOM nodes from parsed blocks. `go(link)` handles an in-app link.
export function renderBlocks(h, blocks, go) {
  const inline = (parts) => parts.map((p) => {
    if (p.code !== undefined) return h("code", {}, p.code);
    if (p.strong) return h("strong", {}, inline(p.strong));
    if (p.em) return h("em", {}, inline(p.em));
    if (p.link) {
      if (p.link.page !== undefined) return h("a", { href: `#/offline-docs`, onClick: (e) => { e.preventDefault(); go(p.link); } }, p.text);
      return h("a", { href: p.link.href, target: "_blank", rel: "noopener noreferrer" }, p.text);
    }
    return p.text;
  });
  return blocks.map((b) => {
    if (b.type === "p") return h("p", {}, inline(b.inline));
    if (b.type === "h") return h(`h${Math.min(b.level + 1, 6)}`, { id: `od-${b.id}`, class: "od-h" }, inline(b.inline));
    if (b.type === "code") return h("pre", { class: "od-code" }, h("code", {}, b.text));
    if (b.type === "hr") return h("hr", {});
    if (b.type === "quote") return h("blockquote", { class: `od-quote ${b.kind}` }, b.kind ? h("strong", {}, b.kind.toUpperCase()) : null, renderBlocks(h, b.blocks, go));
    if (b.type === "ul" || b.type === "ol") return h(b.type, {}, b.items.map((it) => h("li", {}, inline(it))));
    if (b.type === "table") return h("div", { class: "tbl od-table" }, h("table", {}, h("thead", {}, h("tr", {}, b.head.map((c) => h("th", {}, inline(c))))), h("tbody", {}, b.rows.map((r) => h("tr", {}, r.map((c) => h("td", {}, inline(c))))))));
    return null;
  });
}
