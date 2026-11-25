// Regex builder on every search surface. Every search box in the app (a field
// of type "search", or one marked data-regex) gets its own adjacent builder
// button and a plain/regex switch, with its own query, pattern, flags,
// validation, mode and history. Plain text is the default. Matching runs
// locally and is bounded: size limits, a risk check and a worker that is
// stopped after a time limit. Other features reach it through
// globalThis.marNav.regex (matcher, stateOf, attach).
import { FLAG_INFO, SAMPLES, TOKENS, UNSUPPORTED, cleanFlags, compile, explain, matcher, replaceText, runMatches } from "./engine.js";
import { ENGINE, LEDGER, LEDGER_DATE } from "./parity.js";

const NAV = (globalThis.marNav ??= {});
const kv = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
let C = null; // the feature context, set when the overlay mounts
const states = new WeakMap();
const attached = new WeakSet();
const T = (en, yue) => (C ? C.t(en, yue) : en);

// ---- bounded execution ---------------------------------------------------------
let worker = null;
let seq = 0;
export function runBounded(kind, args, timeoutMs = 500) {
  if (typeof Worker === "undefined") return Promise.resolve(kind === "replace" ? replaceText(...args) : runMatches(...args));
  return new Promise((resolve) => {
    const id = ++seq;
    const fresh = !worker;
    try {
      worker ??= new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    } catch {
      return resolve(kind === "replace" ? replaceText(...args) : runMatches(...args));
    }
    const w = worker;
    const timer = setTimeout(() => {
      w.terminate();
      if (worker === w) worker = null;
      resolve({ ok: false, timedOut: true, error: { en: `Stopped after ${timeoutMs} ms. The pattern is too slow for this text.`, yue: `喺 ${timeoutMs} 毫秒後停止。呢個模式對呢段文字太慢。` }, matches: [] });
    }, timeoutMs + (fresh ? 1500 : 0));
    const on = (event) => {
      if (event.data.id !== id) return;
      clearTimeout(timer);
      w.removeEventListener("message", on);
      resolve(event.data.result);
    };
    w.addEventListener("message", on);
    w.postMessage({ id, kind, args });
  });
}

// ---- state per search box --------------------------------------------------------
const boxId = (input) => input.dataset.searchId || (input.closest(".bar") ? "top-bar" : input.closest("dialog")?.dataset.searchScope || input.getAttribute("name") || "search");

export function stateOf(input) {
  let s = states.get(input);
  if (!s) {
    const saved = kv.get(`mar.rx.box.${boxId(input)}`, {});
    s = { id: boxId(input), mode: saved.mode === "regex" ? "regex" : "plain", query: "", pattern: String(saved.pattern ?? ""), flags: cleanFlags(saved.flags ?? "i") || "i", history: kv.get(`mar.rx.hist.${boxId(input)}`, []) };
    states.set(input, s);
  }
  return s;
}
const persist = (s) => kv.set(`mar.rx.box.${s.id}`, { mode: s.mode, pattern: s.pattern, flags: s.flags });
function remember(s) {
  if (!s.pattern || s.history[0] === s.pattern) return;
  s.history = [s.pattern, ...s.history.filter((p) => p !== s.pattern)].slice(0, 20);
  kv.set(`mar.rx.hist.${s.id}`, s.history);
}

// What another feature calls: a test for one box, honouring its mode and flags.
export function matcherFor(input) {
  const s = stateOf(input);
  return matcher({ mode: s.mode, query: input.value, pattern: s.mode === "regex" ? input.value : s.pattern, flags: s.flags });
}

// ---- attaching ------------------------------------------------------------------
function fire(input) {
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setMode(input, mode, controls) {
  const s = stateOf(input);
  if (s.mode === mode) return;
  if (mode === "regex") { s.query = input.value; input.value = s.pattern; } else { s.pattern = input.value; input.value = s.query; }
  s.mode = mode;
  persist(s);
  sync(input, controls);
  fire(input);
}

function sync(input, controls) {
  const s = stateOf(input);
  const regex = s.mode === "regex";
  controls.toggle.setAttribute("aria-pressed", String(regex));
  controls.toggle.classList.toggle("on", regex);
  controls.wrap.classList.toggle("rx-regex", regex);
  input.classList.toggle("mono", regex);
  const check = regex ? compile(input.value, s.flags) : null;
  const bad = regex && input.value !== "" && !check.ok;
  input.setAttribute("aria-invalid", String(bad));
  controls.status.textContent = regex ? (input.value === "" ? T("Regex mode: type a pattern.", "正則模式：輸入模式。") : check.ok ? (check.risk ? T("Valid but risky: it will not run.", "有效但有風險：唔會執行。") : T("Valid pattern.", "有效模式。")) : (C.getLang() === "en" ? check.error.en : check.error.yue)) : "";
  controls.status.classList.toggle("bad", bad || (regex && check?.risk));
}

export function attach(input) {
  if (!C || attached.has(input) || input.dataset.regexSkip !== undefined) return;
  attached.add(input);
  const s = stateOf(input);
  const wrap = C.h("div", { class: "rx-wrap" });
  const status = C.h("span", { class: "sr rx-status", role: "status" });
  const toggle = C.h("button", { type: "button", class: "rx-btn", "aria-pressed": "false", title: T("Use a regular expression in this search", "呢個搜尋用正則表達式"), "aria-label": T("Regular expression mode for this search", "呢個搜尋嘅正則表達式模式") }, C.icon("regular_expression", "sm"));
  const builder = C.h("button", { type: "button", class: "rx-btn", "aria-haspopup": "dialog", title: T("Open the regex builder for this search", "打開呢個搜尋嘅正則建構器"), "aria-label": T("Regex builder for this search", "呢個搜尋嘅正則建構器") }, C.icon("tune", "sm"));
  const controls = { wrap, toggle, builder, status };
  const hadFocus = document.activeElement === input;
  input.replaceWith(wrap);
  wrap.append(input, toggle, builder, status);
  if (hadFocus) input.focus();
  toggle.addEventListener("click", () => setMode(input, stateOf(input).mode === "regex" ? "plain" : "regex", controls));
  builder.addEventListener("click", () => openBuilder(input, controls));
  input.addEventListener("input", () => {
    const st = stateOf(input);
    if (st.mode === "regex") { st.pattern = input.value; persist(st); } else st.query = input.value;
    sync(input, controls);
  });
  input.addEventListener("change", () => remember(stateOf(input)));
  input.addEventListener("keydown", (e) => { if (e.altKey && e.key.toLowerCase() === "r") { e.preventDefault(); toggle.click(); } });
  if (s.mode === "regex") { s.query = input.value; input.value = s.pattern; }
  sync(input, controls);
  if (input.closest(".bar")) topBarResults(input);
}

// The stock top-bar search only does plain matching, so in regex mode this
// draws its results from the same catalogue with the box's own matcher.
function topBarResults(input) {
  input.addEventListener("input", () => {
    const s = stateOf(input);
    const box = input.closest(".bar")?.querySelector(".results");
    if (s.mode !== "regex" || !box) return;
    const m = matcherFor(input);
    box.replaceChildren();
    if (input.value === "") return void (box.hidden = true);
    if (m.error) box.append(C.h("div", { class: "empty" }, C.icon("error", "sm"), C.getLang() === "yue" ? m.error.yue : m.error.en));
    else {
      const catl = C.state.catalog;
      const go = (domain, entry) => () => { input.value = ""; fire(input); box.hidden = true; C.state.focusEntry = entry; C.navigate(domain); };
      const doms = (catl?.domains ?? []).filter((d) => m.test(`${d.label.en}
${d.label.yue}
${d.id}`)).slice(0, 6);
      const ents = (catl?.entries ?? []).filter((e) => m.test(`${e.label.en}
${e.label.yue}
${e.key}`)).slice(0, 12);
      box.append(...doms.map((d) => C.h("button", { role: "option", onClick: go(d.id) }, C.icon(d.icon, "sm"), C.tt(d.label))), ...ents.map((e) => C.h("button", { role: "option", onClick: go(e.domain, e.id) }, C.icon("tune", "sm"), C.tt(e.label))));
      if (!box.children.length) box.append(C.h("div", { class: "empty" }, T("Nothing matches this pattern.", "冇嘢配對呢個模式。")));
    }
    box.hidden = false;
  });
}

// ---- the builder panel --------------------------------------------------------------
let openPanel = null;
function closePanel() {
  openPanel?.remove();
  openPanel = null;
}

function highlight(text, matches) {
  const out = [];
  let at = 0;
  for (const m of matches) {
    if (m.index < at) continue;
    if (m.index > at) out.push(text.slice(at, m.index));
    out.push(C.h("mark", {}, m.text === "" ? "∅" : m.text));
    at = m.end;
  }
  out.push(text.slice(at));
  return out;
}

function tree(nodes) {
  return C.h("ul", { class: "rx-tree" }, nodes.map((n) => C.h("li", {}, C.h("code", {}, n.src), " ", C.h("span", {}, C.getLang() === "yue" ? n.yue : n.en), n.children?.length ? tree(n.children) : null)));
}

function openBuilder(input, controls) {
  closePanel();
  const s = stateOf(input);
  const regexNow = () => (s.mode === "regex" ? input.value : s.pattern);
  const body = C.h("div", { class: "rx-body" });
  let tab = "build";
  let testText = kv.get("mar.rx.test", SAMPLES[0].text);
  let replacement = "";
  const library = () => kv.get("mar.rx.library", []);
  const pattern = C.h("input", { type: "text", class: "field mono", value: regexNow(), spellcheck: "false", autocomplete: "off", "aria-label": T("Pattern", "模式"), "data-regex-skip": "" });
  const apply = (value) => {
    s.pattern = value;
    if (s.mode === "regex") { input.value = value; fire(input); }
    persist(s);
    sync(input, controls);
    draw();
  };
  pattern.addEventListener("input", () => { s.pattern = pattern.value; if (s.mode === "regex") { input.value = pattern.value; fire(input); } persist(s); sync(input, controls); drawLive(); });
  pattern.addEventListener("change", () => remember(s));
  const insert = (token) => {
    const a = pattern.selectionStart ?? pattern.value.length;
    const b = pattern.selectionEnd ?? a;
    pattern.value = pattern.value.slice(0, a) + token + pattern.value.slice(b);
    pattern.focus();
    pattern.setSelectionRange(a + token.length, a + token.length);
    pattern.dispatchEvent(new Event("input"));
  };
  const live = C.h("div", { class: "rx-live", role: "status" });
  const explainBox = C.h("div", { class: "rx-explain" });
  const testOut = C.h("div", { class: "rx-testout" });

  async function drawLive() {
    const v = pattern.value;
    const c = compile(v, s.flags);
    live.replaceChildren(C.h("span", { class: `tag ${c.ok ? (c.risk ? "warn" : "good") : v ? "bad" : ""}` }, c.ok ? (c.risk ? T("Risky, will not run", "有風險，唔會執行") : T("Valid", "有效")) : v ? T("Not valid", "無效") : T("Empty", "空")), " ", C.h("span", { class: "t2" }, c.ok ? (c.risk ? C.tt(c.risk) : "") : C.tt(c.error)));
    explainBox.replaceChildren(v && c.ok ? tree(explain(v)) : C.h("div", { class: "t2" }, T("Type a valid pattern to see what each part does.", "輸入有效模式，就會見到每部分做乜。")));
    if (tab === "test") await drawTest();
  }
  async function drawTest() {
    const v = pattern.value;
    if (!v) return void testOut.replaceChildren(C.h("div", { class: "t2" }, T("Type a pattern on the Build tab first.", "先喺「建構」輸入模式。")));
    const flags = s.flags.includes("g") ? s.flags : `${s.flags}g`;
    const res = await runBounded("run", [v, flags, testText]);
    const rep = replacement !== "" ? await runBounded("replace", [v, flags, testText, replacement]) : null;
    fill(testOut,
      !res.ok ? C.h("div", { class: "note bad" }, C.icon("error", "sm"), C.tt(res.error)) : [
        C.h("div", { class: "rx-hl", "aria-label": T("Highlighted matches", "標示咗嘅配對") }, highlight(testText.slice(0, 20000), res.matches)),
        C.h("div", { class: "t2" }, T(`${res.matches.length} match${res.matches.length === 1 ? "" : "es"}${res.truncated ? " (stopped at the limit)" : ""}`, `${res.matches.length} 個配對${res.truncated ? "（去到上限就停）" : ""}`)),
        C.h("ol", { class: "rx-matches" }, res.matches.slice(0, 50).map((m) => C.h("li", {}, C.h("code", {}, m.text || "∅"), ` @${m.index}`, m.groups.length ? C.h("span", { class: "t2" }, `  ${m.groups.map((g, i) => `$${i + 1}=${g ?? "—"}`).join("  ")}`) : null))),
      ],
      rep ? (rep.ok ? C.h("div", { class: "rx-rep" }, C.h("div", { class: "k" }, T("Replace preview (nothing is changed)", "取代預覽（唔會改任何嘢）")), C.h("pre", { class: "out" }, rep.text)) : C.h("div", { class: "note bad" }, C.tt(rep.error))) : null,
    );
  }

  function draw() {
    const tabs = [["build", T("Build", "建構")], ["test", T("Test", "測試")], ["library", T("Library", "收藏")], ["about", T("Limits", "限制")]];
    const flagBoxes = FLAG_INFO.map(([f, info]) => C.h("label", { class: "chip rx-flag", title: C.tt(info) }, C.h("input", { type: "checkbox", checked: s.flags.includes(f), "aria-label": C.tt(info), onChange: (e) => { s.flags = cleanFlags(e.target.checked ? s.flags + f : s.flags.replace(f, "")); persist(s); sync(input, controls); drawLive(); } }), C.h("code", {}, f), " ", C.h("span", { class: "t2" }, C.tt(info))));
    let content;
    if (tab === "build") {
      content = [
        C.h("label", { class: "lbl" }, T("Pattern", "模式"), pattern),
        live,
        C.h("div", { class: "chips" }, flagBoxes),
        TOKENS.map((g) => C.h("div", { class: "rx-group" }, C.h("div", { class: "k" }, C.tt(g.group)), C.h("div", { class: "chips" }, g.items.map(([tok, en, yue]) => C.h("button", { type: "button", class: "chip", title: T(en, yue), onClick: () => insert(tok.replace("…", "")) }, C.h("code", {}, tok), " ", C.h("span", { class: "t2" }, T(en, yue))))))),
        C.h("div", { class: "k" }, T("What it does", "佢做乜")),
        explainBox,
        s.history.length ? C.h("div", { class: "rx-hist" }, C.h("div", { class: "k" }, T("Recent patterns", "最近用過")), C.h("div", { class: "chips" }, s.history.slice(0, 6).map((p) => C.h("button", { type: "button", class: "chip", onClick: () => { pattern.value = p; pattern.dispatchEvent(new Event("input")); } }, C.h("code", {}, p))))) : null,
      ];
    } else if (tab === "test") {
      const ta = C.h("textarea", { class: "field", rows: "4", "aria-label": T("Text to test against", "測試用嘅文字"), maxlength: "20000", onInput: (e) => { testText = e.target.value; kv.set("mar.rx.test", testText); drawTest(); } });
      ta.value = testText;
      const rep = C.h("input", { type: "text", class: "field", "data-regex-skip": "", "aria-label": T("Replacement", "取代為"), placeholder: "$1", value: replacement, onInput: (e) => { replacement = e.target.value; drawTest(); } });
      content = [C.h("label", { class: "lbl" }, T("Text to test", "測試文字"), ta), C.h("label", { class: "lbl" }, T("Replace with (preview only)", "取代為（只係預覽）"), rep), testOut];
    } else if (tab === "library") {
      const mine = library();
      const row = (name, p, f, text, del) => C.h("div", { class: "row" }, C.h("div", { class: "grow" }, C.h("div", { class: "t1" }, name), C.h("code", { class: "t2" }, p)), C.h("button", { class: "btn t sm", type: "button", onClick: () => { s.flags = cleanFlags(f); if (text) { testText = text; kv.set("mar.rx.test", text); } pattern.value = p; pattern.dispatchEvent(new Event("input")); tab = "build"; draw(); } }, T("Use", "用")), del ? C.h("button", { class: "btn o sm", type: "button", "aria-label": `${T("Delete", "刪除")} ${name}`, onClick: del }, C.icon("delete", "sm")) : null);
      content = [
        C.h("button", { class: "btn f sm", type: "button", disabled: !pattern.value || !compile(pattern.value, s.flags).ok, onClick: () => { kv.set("mar.rx.library", [{ name: pattern.value.slice(0, 40), pattern: pattern.value, flags: s.flags }, ...mine].slice(0, 50)); C.toast(T("Saved to your library.", "已儲存到收藏。")); draw(); } }, C.icon("bookmark_add", "sm"), T("Save this pattern", "儲存呢個模式")),
        C.h("div", { class: "k" }, T("Your patterns", "你嘅模式")), mine.length ? mine.map((m, i) => row(m.name, m.pattern, m.flags, "", () => { kv.set("mar.rx.library", mine.filter((_, j) => j !== i)); draw(); })) : C.h("div", { class: "t2" }, T("Nothing saved yet.", "未有儲存。")),
        C.h("div", { class: "k" }, T("Ready-made", "現成")), SAMPLES.map((x) => row(C.tt(x.name), x.pattern, x.flags, x.text)),
      ];
    } else {
      content = [
        C.h("div", { class: "t2" }, `${T("Engine", "引擎")}: ${ENGINE}. ${T("Limits", "上限")}: 500 ${T("pattern characters", "個模式字元")}, 200000 ${T("text characters", "個文字字元")}, 1000 ${T("matches", "個配對")}, 500 ms.`),
        C.h("div", { class: "k" }, `${T("Parity ledger", "對照表")} ${LEDGER_DATE}`),
        C.h("ul", { class: "rx-ledger" }, LEDGER.map((l) => C.h("li", {}, C.h("span", { class: `tag ${l.state === "done" ? "good" : l.state === "partial" ? "warn" : "bad"}` }, l.state === "done" ? T("Done", "完成") : l.state === "partial" ? T("Partly", "部分") : T("Unfinished", "未做")), " ", C.h("b", {}, l.topic), " ", C.h("span", { class: "t2" }, l.note)))),
        C.h("div", { class: "k" }, T("Not supported", "未支援")), C.h("ul", {}, UNSUPPORTED.map((u) => C.h("li", {}, C.tt(u)))),
      ];
    }
    fill(body,
      C.h("div", { class: "seg", role: "tablist" }, tabs.map(([id, label]) => C.h("button", { role: "tab", type: "button", "aria-selected": String(id === tab), class: id === tab ? "on" : "", onClick: () => { tab = id; draw(); drawLive(); } }, label))),
      content,
      C.h("div", { class: "rx-modebar" },
        C.h("span", { class: "t2" }, s.mode === "regex" ? T("This search box is using the pattern.", "呢個搜尋框而家用緊模式。") : T("This search box is plain text. Your pattern is kept separately.", "呢個搜尋框係純文字，你嘅模式會獨立保存。")),
        C.h("button", { class: "btn t sm", type: "button", onClick: () => { setMode(input, s.mode === "regex" ? "plain" : "regex", controls); draw(); } }, s.mode === "regex" ? T("Back to plain text", "轉返純文字") : T("Search with this pattern", "用呢個模式搜尋"))),
    );
  }

  const host = input.closest("dialog") ?? document.body;
  const panel = C.h("div", { class: "rx-panel", role: "dialog", "aria-label": T("Regex builder", "正則建構器") },
    C.h("div", { class: "rx-head" }, C.h("b", {}, T("Regex builder", "正則建構器")), C.h("button", { class: "icb", type: "button", "aria-label": T("Close", "關閉"), onClick: () => { closePanel(); builder.focus(); } }, C.icon("close", "sm"))),
    body);
  const builder = controls.builder;
  host.append(panel);
  openPanel = panel;
  const r = controls.wrap.getBoundingClientRect();
  const width = Math.min(560, window.innerWidth - 24);
  panel.style.setProperty("width", `${width}px`);
  panel.style.setProperty("left", `${Math.max(12, Math.min(r.left, window.innerWidth - width - 12))}px`);
  panel.style.setProperty("top", `${Math.max(8, Math.min(r.bottom + 6, window.innerHeight - 260))}px`);
  panel.style.setProperty("max-height", `${Math.max(240, window.innerHeight - Math.min(r.bottom + 6, window.innerHeight - 260) - 12)}px`);
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); closePanel(); builder.focus(); } });
  draw();
  drawLive();
  pattern.focus();
}

// Click outside the panel closes it.
const outside = (e) => { if (openPanel && !openPanel.contains(e.target) && !e.target.closest?.(".rx-btn")) closePanel(); };

function scan(root) {
  for (const input of root.querySelectorAll?.("input[type=search], input[data-regex]") ?? []) attach(input);
}

NAV.regex = { attach, stateOf, matcherFor, runBounded, compile, explain, engine: ENGINE };

export default {
  id: "regex-search",
  overlays: [
    {
      id: "regex-search.attach",
      mount(ctx) {
        C = ctx;
        scan(document);
        const observer = new MutationObserver((records) => {
          for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) { if (n.matches?.("input[type=search], input[data-regex]")) attach(n); scan(n); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener("pointerdown", outside, true);
        return () => { observer.disconnect(); document.removeEventListener("pointerdown", outside, true); closePanel(); };
      },
    },
  ],
  commands: [
    { id: "regex-search.about", icon: "regular_expression", label: { en: "Regex builder: limits and parity ledger", yue: "正則建構器：限制同對照表" }, keywords: "regex regular expression pattern search", run: (ctx) => { const el = document.querySelector("input[type=search]"); if (el) el.parentElement.querySelector(".rx-btn[aria-haspopup]")?.click(); else ctx.toast(ctx.t("Open a screen with a search box first.", "先開有搜尋框嘅畫面。")); } },
  ],
};
