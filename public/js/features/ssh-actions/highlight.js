// A small syntax highlighter for the files a router keeps: shell scripts,
// JSON and plain settings files. It returns tokens that always join back into
// exactly the original text, so the editor can lay them behind a textarea.
// It imports nothing, so Node tests can run it.

export function languageOf(path = "", text = "") {
  const name = path.split("/").pop().toLowerCase();
  if (/\.(sh|ash|bash)$/.test(name) || text.startsWith("#!") || /^\/jffs\/scripts\//.test(path) || /^\/opt\/etc\/init\.d\//.test(path)) return "shell";
  if (/\.json$/.test(name)) return "json";
  if (/\.(conf|cfg|ini|add|rules|env)$/.test(name) || /^\/jffs\/configs\//.test(path)) return "conf";
  return "plain";
}

const SHELL_KEYWORDS = new Set(["if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done", "case", "esac", "in", "function", "return", "exit", "break", "continue", "local", "export", "set", "unset", "shift", "trap"]);

function scan(text, rules) {
  const out = [];
  let plain = "";
  const flush = () => { if (plain) out.push({ cls: "", text: plain }), (plain = ""); };
  let i = 0;
  while (i < text.length) {
    let hit = null;
    for (const [cls, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(text);
      if (m && m.index === i && m[0].length) { hit = [cls, m[0]]; break; }
    }
    if (hit) {
      const cls = typeof hit[0] === "function" ? hit[0](hit[1]) : hit[0];
      flush();
      out.push({ cls, text: hit[1] });
      i += hit[1].length;
    } else plain += text[i++];
  }
  flush();
  return out;
}

const SHELL = [
  ["cm", /#[^\n]*/y],
  ["str", /'[^']*'?/y],
  ["str", /"(?:\\.|[^"\\\n])*"?/y],
  ["var", /\$(?:\{[^}\n]*\}?|[A-Za-z_][A-Za-z0-9_]*|[0-9@#?!*$-])/y],
  [(word) => (SHELL_KEYWORDS.has(word) ? "kw" : ""), /[A-Za-z_][A-Za-z0-9_-]*/y],
  ["num", /\b\d+\b/y],
  ["op", /[|&;<>()]+/y],
];
const JSON_RULES = [
  ["key", /"(?:\\.|[^"\\\n])*"(?=\s*:)/y],
  ["str", /"(?:\\.|[^"\\\n])*"?/y],
  ["num", /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y],
  ["kw", /\b(?:true|false|null)\b/y],
  ["op", /[{}[\],:]/y],
];
const CONF = [
  ["cm", /^[ \t]*[#;][^\n]*/my],
  ["key", /^[ \t]*[A-Za-z0-9_.-]+(?=[ \t]*=)/my],
  ["op", /=/y],
  ["str", /"(?:\\.|[^"\\\n])*"?/y],
  ["num", /\b\d+(?:\.\d+)*\b/y],
];

export function highlight(text, lang) {
  if (lang === "shell") return scan(text, SHELL);
  if (lang === "json") return scan(text, JSON_RULES);
  if (lang === "conf") return scan(text, CONF);
  return [{ cls: "", text }];
}

// Draws tokens into an element with spans, one class each.
export function paint(h, el, tokens) {
  el.replaceChildren(...tokens.map((tk) => (tk.cls ? h("span", { class: `hl-${tk.cls}` }, tk.text) : tk.text)));
  // A final line break would collapse, so the highlight layer always ends with a space.
  el.append(" ");
}
