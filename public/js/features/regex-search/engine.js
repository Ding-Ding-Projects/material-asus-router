// The regular expression engine behind every search box in the app. It is plain
// JavaScript with no imports so the browser, the worker and the Node tests all
// run the same code. The engine is the browser's own JavaScript (ECMAScript)
// regular expression engine; nothing here pretends to be another flavour.

export const MAX_PATTERN = 500;
export const MAX_TEXT = 200000;
export const MAX_MATCHES = 1000;
export const FLAG_INFO = [
  ["i", { en: "Ignore case", yue: "唔分大細楷" }],
  ["m", { en: "^ and $ match at every line", yue: "^ 同 $ 對每一行都生效" }],
  ["s", { en: "Dot matches line breaks", yue: "點號都配對換行" }],
  ["u", { en: "Unicode mode", yue: "Unicode 模式" }],
  ["g", { en: "Find every match", yue: "搵晒所有配對" }],
  ["y", { en: "Sticky: match only at the last position", yue: "黏著：只喺上次位置配對" }],
  ["d", { en: "Report match indices", yue: "報告配對位置" }],
];
const FLAG_ORDER = "dgimsuyv";

export const cleanFlags = (flags) =>
  [...new Set(String(flags ?? ""))]
    .filter((f) => FLAG_ORDER.includes(f) && f !== "v")
    .sort((a, b) => FLAG_ORDER.indexOf(a) - FLAG_ORDER.indexOf(b))
    .join("");

// Heuristics that refuse the shapes that make a backtracking engine run for ever
// (a repeated group that itself contains a repeat). The worker's time limit is
// the real protection; this only lets the page answer instantly for the obvious cases.
export function riskOf(pattern) {
  if (/\((?:[^()\\]|\\.)*(?:[+*]|\{\d+,\d*\})(?:[^()\\]|\\.)*\)(?:[+*]|\{\d+,\d*\})/.test(pattern))
    return { en: "A repeated group contains its own repeat, which can run for ever on some text.", yue: "重複嘅群組入面仲有重複，某啲文字可能會跑極都未完。" };
  if (/\((\w)\|\1\)[+*]/.test(pattern)) return { en: "A repeated alternation has branches that overlap.", yue: "重複嘅選擇有重疊嘅分支。" };
  return null;
}

// Compiles or says exactly what is wrong. Never throws.
export function compile(pattern, flags = "") {
  const f = cleanFlags(flags);
  if (typeof pattern !== "string" || pattern === "") return { ok: false, empty: true, error: { en: "Type a pattern.", yue: "輸入一個模式。" } };
  if (pattern.length > MAX_PATTERN) return { ok: false, error: { en: `A pattern can be up to ${MAX_PATTERN} characters.`, yue: `模式最多 ${MAX_PATTERN} 個字元。` } };
  try {
    return { ok: true, re: new RegExp(pattern, f), flags: f, risk: riskOf(pattern) };
  } catch (error) {
    const why = String(error.message).replace(/^Invalid regular expression: /, "");
    return { ok: false, error: { en: why, yue: `模式有錯：${why}` } };
  }
}

// Every match, bounded by count and text size. Refuses risky patterns up front.
export function runMatches(pattern, flags, text, { maxMatches = MAX_MATCHES } = {}) {
  const c = compile(pattern, flags);
  if (!c.ok) return { ok: false, error: c.error, matches: [] };
  if (c.risk) return { ok: false, refused: true, error: c.risk, matches: [] };
  const subject = String(text ?? "").slice(0, MAX_TEXT);
  const re = new RegExp(c.re.source, c.flags.includes("g") ? c.flags : `${c.flags}g`);
  const matches = [];
  let truncated = false;
  for (let m = re.exec(subject); m; m = re.exec(subject)) {
    matches.push({ index: m.index, end: m.index + m[0].length, text: m[0], groups: m.slice(1), named: m.groups ? { ...m.groups } : null });
    if (m[0] === "") re.lastIndex += 1;
    if (matches.length >= maxMatches) { truncated = true; break; }
    if (!c.flags.includes("g")) break;
  }
  return { ok: true, matches, truncated, inputTruncated: String(text ?? "").length > MAX_TEXT };
}

// Expands $1, $<name>, $&, $$ the way String.replace does.
function expand(template, args) {
  const named = typeof args.at(-1) === "object" ? args.at(-1) : null;
  const rest = named ? args.slice(0, -1) : args;
  const subject = rest.at(-1);
  const offset = rest.at(-2);
  const groups = rest.slice(1, -2);
  return template.replace(/\$(\$|&|`|'|\d{1,2}|<[^>]*>)/g, (all, token) => {
    if (token === "$") return "$";
    if (token === "&") return rest[0];
    if (token === "`") return subject.slice(0, offset);
    if (token === "'") return subject.slice(offset + rest[0].length);
    if (token[0] === "<") return named?.[token.slice(1, -1)] ?? "";
    const n = Number(token);
    return n >= 1 && n <= groups.length ? groups[n - 1] ?? "" : all;
  });
}

export function replaceText(pattern, flags, text, replacement) {
  const c = compile(pattern, flags);
  if (!c.ok) return { ok: false, error: c.error };
  if (c.risk) return { ok: false, refused: true, error: c.risk };
  const subject = String(text ?? "").slice(0, MAX_TEXT);
  const re = new RegExp(c.re.source, c.flags.includes("g") ? c.flags : `${c.flags}g`);
  let count = 0;
  const out = subject.replace(re, (...args) => {
    count += 1;
    return count > MAX_MATCHES ? args[0] : expand(String(replacement ?? ""), args);
  });
  return { ok: true, text: out, count: Math.min(count, MAX_MATCHES) };
}

// Turns the state of one search box into a test for short strings (search
// results). Plain mode is a case-insensitive substring test.
export function matcher({ mode = "plain", query = "", pattern = "", flags = "i" } = {}) {
  if (mode !== "regex") {
    const q = String(query).trim().toLowerCase();
    return { test: (text) => !q || String(text).toLowerCase().includes(q), error: null, mode: "plain" };
  }
  if (pattern === "") return { test: () => true, error: null, mode: "regex" };
  const c = compile(pattern, String(flags).replace(/[gy]/g, ""));
  if (!c.ok) return { test: () => false, error: c.error, mode: "regex" };
  if (c.risk) return { test: () => false, error: c.risk, mode: "regex" };
  // A search text may hold several parts (English label, Cantonese label, key) on separate
  // lines; a pattern such as ^Wi-Fi$ is tested against each part as well as the whole.
  return { test: (text) => { const s = String(text).slice(0, 2000); return s.split("\n").some((part) => c.re.test(part)) || c.re.test(s); }, error: null, mode: "regex" };
}

// ---- explanation tree --------------------------------------------------------

const ESCAPES = {
  d: ["a digit", "一個數字"], D: ["anything but a digit", "任何非數字"], w: ["a letter, digit or underscore", "字母、數字或底線"], W: ["anything but a letter, digit or underscore", "字母、數字、底線以外"],
  s: ["a space, tab or line break", "空格、tab 或換行"], S: ["anything but whitespace", "任何非空白"], b: ["a word boundary", "字詞邊界"], B: ["not a word boundary", "非字詞邊界"],
  n: ["a line feed", "換行"], r: ["a carriage return", "歸位"], t: ["a tab", "tab 字元"], f: ["a form feed", "換頁"], v: ["a vertical tab", "垂直 tab"], 0: ["a null character", "空字元"],
};
const node = (src, en, yue, children) => ({ src, en, yue, ...(children ? { children } : {}) });

export function explain(pattern) {
  let i = 0;
  const peek = () => pattern[i];
  function quant(base) {
    const c = peek();
    let q = null;
    if (c === "*") q = ["zero or more times", "零次或以上"];
    else if (c === "+") q = ["one or more times", "一次或以上"];
    else if (c === "?") q = ["optionally", "可有可無"];
    else if (c === "{") {
      const m = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(i));
      if (m) {
        const [, lo, comma, hi] = m;
        q = !comma ? [`exactly ${lo} times`, `啱啱 ${lo} 次`] : hi === "" ? [`${lo} or more times`, `${lo} 次或以上`] : [`${lo} to ${hi} times`, `${lo} 至 ${hi} 次`];
        i += m[0].length - 1;
      }
    }
    if (!q) return base;
    const start = i;
    i += 1;
    let lazy = false;
    if (peek() === "?") { lazy = true; i += 1; }
    const src = pattern.slice(start, i);
    return node(base.src + src, `${base.en}, ${q[0]}${lazy ? " (as few as possible)" : ""}`, `${base.yue}，${q[1]}${lazy ? "（盡量少）" : ""}`, base.children);
  }
  function atom() {
    const c = peek();
    if (c === "\\") {
      const n = pattern[i + 1] ?? "";
      const here = pattern.slice(i);
      let len = 2;
      let d;
      if (n === "u" && /^\\u[0-9a-fA-F]{4}/.test(here)) { len = 6; const hex = pattern.slice(i + 2, i + 6).toUpperCase(); d = [`the character U+${hex}`, `字元 U+${hex}`]; }
      else if (n === "x" && /^\\x[0-9a-fA-F]{2}/.test(here)) { len = 4; d = [`the character 0x${pattern.slice(i + 2, i + 4)}`, `字元 0x${pattern.slice(i + 2, i + 4)}`]; }
      else if ((n === "p" || n === "P") && /^\\[pP]\{[^}]+\}/.test(here)) { const m = /^\\[pP]\{([^}]+)\}/.exec(here); len = m[0].length; d = [`${n === "P" ? "not " : ""}the Unicode property ${m[1]}`, `${n === "P" ? "非 " : ""}Unicode 屬性 ${m[1]}`]; }
      else if (n === "k" && /^\\k<[^>]+>/.test(here)) { const m = /^\\k<([^>]+)>/.exec(here); len = m[0].length; d = [`the same text as group "${m[1]}"`, `同群組「${m[1]}」一樣嘅文字`]; }
      else if (/[1-9]/.test(n)) d = [`the same text as group ${n}`, `同群組 ${n} 一樣嘅文字`];
      else if (ESCAPES[n]) d = ESCAPES[n];
      else d = [`the character "${n}"`, `字元「${n}」`];
      i += len;
      return node(pattern.slice(i - len, i), d[0], d[1]);
    }
    if (c === "[") {
      let j = i + 1;
      if (pattern[j] === "^") j += 1;
      if (pattern[j] === "]") j += 1;
      while (j < pattern.length && pattern[j] !== "]") j += pattern[j] === "\\" ? 2 : 1;
      const src = pattern.slice(i, j + 1);
      i = j + 1;
      const neg = src[1] === "^";
      const body = src.slice(neg ? 2 : 1, -1) || "nothing";
      return node(src, `${neg ? "any character except" : "any one of"} ${body}`, `${neg ? "除咗以下以外嘅任何字元：" : "以下其中一個："}${body}`);
    }
    if (c === "(") {
      const rest = pattern.slice(i);
      let head = "(";
      let en = "a capturing group";
      let yue = "捕捉群組";
      const m = /^\(\?(?:<([A-Za-z_]\w*)>|:|=|!|<=|<!)/.exec(rest);
      if (m) {
        head = m[0];
        if (m[1]) { en = `a group named "${m[1]}"`; yue = `名為「${m[1]}」嘅群組`; }
        else if (head === "(?:") { en = "a group that does not capture"; yue = "唔捕捉嘅群組"; }
        else if (head === "(?=") { en = "a lookahead: what follows must match"; yue = "前瞻：後面一定要配對"; }
        else if (head === "(?!") { en = "a negative lookahead: what follows must not match"; yue = "否定前瞻：後面唔可以配對"; }
        else if (head === "(?<=") { en = "a lookbehind: what comes before must match"; yue = "後顧：前面一定要配對"; }
        else { en = "a negative lookbehind: what comes before must not match"; yue = "否定後顧：前面唔可以配對"; }
      }
      i += head.length;
      const children = alternation();
      const closed = peek() === ")";
      if (closed) i += 1;
      return node(`${head}…${closed ? ")" : ""}`, en, yue, children);
    }
    i += 1;
    if (c === ".") return node(".", "any character", "任何字元");
    if (c === "^") return node("^", "the start of the text or line", "文字或者行首");
    if (c === "$") return node("$", "the end of the text or line", "文字或者行尾");
    return node(c, `the character "${c}"`, `字元「${c}」`);
  }
  function alternation() {
    const out = [];
    while (i < pattern.length && peek() !== ")") {
      if (peek() === "|") { out.push(node("|", "or", "或者")); i += 1; continue; }
      out.push(quant(atom()));
    }
    return out;
  }
  const tree = alternation();
  while (i < pattern.length) { tree.push(node(pattern[i], `an unmatched "${pattern[i]}"`, `未配對嘅「${pattern[i]}」`)); i += 1; }
  return tree;
}

// ---- tokens for the palette --------------------------------------------------

export const TOKENS = [
  { group: { en: "Characters", yue: "字元" }, items: [["\\d", "digit", "數字"], ["\\w", "word character", "字詞字元"], ["\\s", "whitespace", "空白"], [".", "any character", "任何字元"], ["[abc]", "one of a set", "其中一個"], ["[^abc]", "not in a set", "唔喺集合入面"], ["\\p{L}", "any letter (Unicode)", "任何字母（Unicode）"]] },
  { group: { en: "Anchors", yue: "錨點" }, items: [["^", "start", "開頭"], ["$", "end", "結尾"], ["\\b", "word boundary", "字詞邊界"]] },
  { group: { en: "Repeats", yue: "重複" }, items: [["*", "zero or more", "零次或以上"], ["+", "one or more", "一次或以上"], ["?", "optional", "可有可無"], ["{2,5}", "a range of times", "次數範圍"], ["*?", "lazy: as few as possible", "懶惰：盡量少"]] },
  { group: { en: "Groups", yue: "群組" }, items: [["(…)", "capture", "捕捉"], ["(?:…)", "group only", "只作群組"], ["(?<name>…)", "named group", "命名群組"], ["a|b", "alternation", "選擇"], ["(?=…)", "lookahead", "前瞻"], ["(?<=…)", "lookbehind", "後顧"]] },
];

export const SAMPLES = [
  { id: "ipv4", name: { en: "IPv4 address", yue: "IPv4 地址" }, pattern: "\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b", flags: "g", text: "Router 198.51.100.1 and 203.0.113.7" },
  { id: "mac", name: { en: "MAC address", yue: "MAC 地址" }, pattern: "\\b[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}\\b", flags: "g", text: "Laptop AA:BB:CC:DD:EE:FF" },
  { id: "word", name: { en: "Whole word", yue: "完整字詞" }, pattern: "\\bwifi\\b", flags: "gi", text: "WiFi and wifi, not wifiX" },
  { id: "port", name: { en: "Port number", yue: "端口號" }, pattern: ":(\\d{1,5})\\b", flags: "g", text: "198.51.100.20:8080" },
];

// ---- what is not supported -----------------------------------------------------

export const UNSUPPORTED = [
  { id: "flavours", en: "Other regex flavours (PCRE, .NET, Python, Java, POSIX) and flavour comparison or conversion: only the JavaScript engine is built in.", yue: "其他正則風味（PCRE、.NET、Python、Java、POSIX）同風味比較或轉換：只內置咗 JavaScript 引擎。" },
  { id: "trace", en: "A step-by-step debugger that traces how the engine matches: not built yet.", yue: "逐步追蹤引擎配對過程嘅除錯器：未做。" },
  { id: "benchmark", en: "Benchmarking one pattern against another: not built yet.", yue: "比較不同模式效能嘅基準測試：未做。" },
  { id: "codegen", en: "Generating source code for other languages from a pattern: not built yet.", yue: "由模式產生其他語言原始碼：未做。" },
  { id: "grep", en: "Safe search across files on disk with a backup restore: not available in a web page.", yue: "喺磁碟檔案做安全搜尋同備份還原：網頁入面做唔到。" },
  { id: "v-flag", en: "The v flag (set notation) is not offered.", yue: "唔提供 v 旗標（集合記法）。" },
];
