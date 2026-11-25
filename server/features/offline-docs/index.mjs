// The offline documentation browser's server half. It reads the Markdown
// articles and wiki pages from the docs/ folder when that folder is present
// next to the app (a container image carries it only if the build copies it in)
// and serves them to the in-app reader. Nothing leaves the computer.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID = "offline-docs";
export const DOCS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs");
const SLUG = /^(wiki:)?[a-z0-9-]+(\/[a-z0-9-]+)?$/;

// Reads the "key: value" block at the top of a file.
export function frontMatter(text) {
  const m = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: String(text) };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.name.endsWith(".md")) out.push(full);
  }
  return out;
}

const slugOf = (file) => {
  const rel = path.relative(DOCS, file).split(path.sep).join("/").replace(/\.zh-HK\.md$|\.md$/, "");
  if (rel.startsWith("wiki/")) return `wiki:${rel.slice(5)}`;
  return rel.startsWith("articles/") ? rel.slice(9) : null;
};

export async function buildIndex() {
  const files = [...(await walk(path.join(DOCS, "articles"))), ...(await walk(path.join(DOCS, "wiki")))].filter((f) => path.basename(f) !== "README.md");
  const bySlug = new Map();
  for (const file of files) {
    const slug = slugOf(file);
    if (!slug) continue;
    const twin = file.endsWith(".zh-HK.md");
    const entry = bySlug.get(slug) ?? { slug, files: [] };
    entry.files.push(path.relative(DOCS, file).split(path.sep).join("/"));
    const { meta } = frontMatter(await readFile(file, "utf8"));
    if (twin) {
      entry.yue = { title: meta.title ?? "", summary: meta.summary ?? "" };
    } else {
      Object.assign(entry, { title: meta.title ?? slug, summary: meta.summary ?? "", category: meta.category ?? (slug.startsWith("wiki:") ? "wiki" : slug.split("/")[0]), order: Number(meta.order ?? 99), status: meta.status ?? "", related: (meta.related ?? "").split(",").map((s) => s.trim()).filter(Boolean) });
    }
    bySlug.set(slug, entry);
  }
  return [...bySlug.values()].filter((e) => e.title).sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order || a.title.localeCompare(b.title));
}

export default {
  id: ID,
  domainMeta: [],

  routes(api) {
    api.get("/index", async () => {
      const articles = await buildIndex();
      const files = articles.reduce((n, a) => n + a.files.length, 0);
      return { present: articles.length > 0, articles, count: articles.length, fileCount: files };
    });

    // Every page's title and text in one language, for the in-app search (done in the browser).
    api.get("/corpus", async ({ query }) => {
      const yue = query.lang === "yue";
      const pages = [];
      for (const entry of await buildIndex()) {
        const file = entry.files.find((f) => (yue ? f.endsWith(".zh-HK.md") : !f.endsWith(".zh-HK.md"))) ?? entry.files[0];
        const { meta, body } = frontMatter(await readFile(path.join(DOCS, file), "utf8"));
        pages.push({ slug: entry.slug, title: meta.title ?? entry.title, text: body });
      }
      return { pages, lang: yue ? "yue" : "en" };
    });

    api.get("/article", async ({ query, bad }) => {
      const slug = String(query.slug ?? "");
      if (!SLUG.test(slug)) throw bad("That is not a valid page name.");
      const base = slug.startsWith("wiki:") ? path.join(DOCS, "wiki", slug.slice(5)) : path.join(DOCS, "articles", slug);
      const wantYue = query.lang === "yue";
      let file = wantYue ? `${base}.zh-HK.md` : `${base}.md`;
      let lang = wantYue ? "yue" : "en";
      let text;
      try {
        text = await readFile(file, "utf8");
      } catch {
        try {
          file = `${base}.md`;
          lang = "en";
          text = await readFile(file, "utf8");
        } catch {
          throw bad("That page is not in the bundled documentation.", 404);
        }
      }
      const { meta, body } = frontMatter(text);
      return { slug, lang, title: meta.title ?? slug, summary: meta.summary ?? "", status: meta.status ?? "", related: (meta.related ?? "").split(",").map((s) => s.trim()).filter(Boolean), markdown: body };
    });
  },
};
