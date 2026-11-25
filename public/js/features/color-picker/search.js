// A search box with plain-text and regular-expression modes, plus a small
// regex builder next to it. The query, mode, flags and validation live in one
// state object, so the box and the builder always agree.

export const MAX_PATTERN = 200;
const FLAGS = ["i", "s", "u"];

// compileSearch({ mode, query, flags }) -> { ok, test(text), error }
export function compileSearch({ mode = "plain", query = "", flags = "i" } = {}) {
  const text = String(query);
  if (mode !== "regex") {
    const needle = text.trim().toLowerCase();
    return { ok: true, empty: needle === "", test: (s) => needle === "" || String(s).toLowerCase().includes(needle) };
  }
  if (text === "") return { ok: true, empty: true, test: () => true };
  if (text.length > MAX_PATTERN) return { ok: false, error: `A pattern can be at most ${MAX_PATTERN} characters.` };
  const clean = [...new Set([...String(flags)].filter((f) => FLAGS.includes(f)))].join("");
  // Nested quantifiers such as (a+)+ can take exponential time, so they are refused. Matching is also
  // only ever run against short names, which keeps every search bounded.
  if (/\([^)]*[+*][^)]*\)[+*{]|\([^)]*\{\d+,?\d*\}[^)]*\)[+*{]/.test(text)) return { ok: false, error: "That pattern repeats a repeat, which can hang the search. Simplify it." };
  try {
    const re = new RegExp(text, clean);
    return { ok: true, empty: false, flags: clean, test: (s) => re.test(String(s)) };
  } catch (error) {
    return { ok: false, error: String(error.message).replace(/^Invalid regular expression: /, "") };
  }
}

const TOKENS = [
  [".", { en: "Any character", yue: "任何字元" }],
  ["\\d", { en: "A digit", yue: "數字" }],
  ["\\w", { en: "A letter, digit or underscore", yue: "字母、數字或底線" }],
  ["^", { en: "Start of the name", yue: "名稱開頭" }],
  ["$", { en: "End of the name", yue: "名稱結尾" }],
  ["[a-m]", { en: "A character from a range", yue: "範圍內嘅字元" }],
  ["(a|b)", { en: "One of several options", yue: "多個選項其中一個" }],
  ["?", { en: "Optional (0 or 1)", yue: "可有可無" }],
  ["+", { en: "One or more", yue: "一個或以上" }],
  ["*", { en: "Zero or more", yue: "零個或以上" }],
];

// state: { mode: "plain" | "regex", query, flags }
export function createSearchBox(ctx, { items, label, onChange, state = { mode: "plain", query: "", flags: "i" } }) {
  const { h, icon, t, tt } = ctx;
  const input = h("input", { class: "field", type: "search", autocomplete: "off", spellcheck: "false", "aria-label": tt(label), maxlength: String(MAX_PATTERN) });
  const status = h("div", { class: "t2", role: "status" });
  const modeBtn = h("button", { type: "button", class: "btn o sm", "aria-pressed": "false", onClick: () => { state.mode = state.mode === "regex" ? "plain" : "regex"; run(); } }, icon("regular_expression", "sm"), t("Regex", "正則"));
  const flagBoxes = FLAGS.map((f) => {
    const box = h("input", { type: "checkbox", "aria-label": { i: t("Ignore case", "唔分大細楷"), s: t("Dot matches newline", "點號包括換行"), u: t("Unicode", "Unicode") }[f], onChange: () => { state.flags = FLAGS.filter((x, i) => flagBoxes[i].checked).join(""); run(); } });
    return box;
  });
  const builder = h("div", { class: "cp-builder", hidden: true }, h("div", { class: "t2" }, t("Insert a piece of a pattern:", "插入模式嘅一部分：")), h("div", { class: "chips" }, TOKENS.map(([tok, about]) => h("button", { type: "button", class: "chip", title: tt(about), "aria-label": `${tok} ${tt(about)}`, onClick: () => insert(tok) }, tok))), h("div", { class: "chips" }, FLAGS.map((f, i) => h("label", { class: "chip" }, flagBoxes[i], { i: t("ignore case", "唔分大細楷"), s: t("dot = newline", "點號 = 換行"), u: "unicode" }[f]))));

  function insert(tok) {
    const a = input.selectionStart ?? input.value.length;
    const b = input.selectionEnd ?? a;
    input.value = input.value.slice(0, a) + tok + input.value.slice(b);
    input.focus();
    input.setSelectionRange(a + tok.length, a + tok.length);
    state.query = input.value;
    run();
  }
  function run() {
    const compiled = compileSearch(state);
    modeBtn.setAttribute("aria-pressed", String(state.mode === "regex"));
    modeBtn.classList.toggle("on", state.mode === "regex");
    builder.hidden = state.mode !== "regex";
    flagBoxes.forEach((b, i) => { b.checked = state.flags.includes(FLAGS[i]); });
    input.setAttribute("aria-invalid", String(!compiled.ok));
    input.placeholder = state.mode === "regex" ? t("Pattern, for example ^dark.*blue$", "模式，例如 ^dark.*blue$") : t("Search by name", "按名稱搜尋");
    const matches = compiled.ok ? items.filter((it) => compiled.test(it.name)) : [];
    status.textContent = compiled.ok ? `${matches.length} / ${items.length} ${t("match", "個符合")}` : `${t("Pattern problem:", "模式有問題：")} ${compiled.error}`;
    status.classList.toggle("err", !compiled.ok);
    onChange({ compiled, matches, state: { ...state } });
  }
  input.addEventListener("input", () => { state.query = input.value; run(); });
  input.value = state.query;
  const el = h("div", { class: "cp-search" }, h("div", { class: "cp-searchrow" }, input, modeBtn), builder, status);
  queueMicrotask(run);
  return { el, state, run };
}
