// The regex engine behind every search box: valid, invalid, Unicode,
// multiline and adversarial patterns, replacement, bounds, the matcher the
// search surfaces use, the explanation tree, and the honest ledger.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/regex-search/index.js";
import { MAX_MATCHES, MAX_PATTERN, SAMPLES, TOKENS, UNSUPPORTED, cleanFlags, compile, explain, matcher, replaceText, riskOf, runMatches } from "../../public/js/features/regex-search/engine.js";
import { ENGINE, LEDGER } from "../../public/js/features/regex-search/parity.js";
import { assertModuleListed } from "../nav-kit.mjs";

test("regex-search: valid patterns find every match with groups and positions", () => {
  const r = runMatches("(\\d+)-(?<word>[a-z]+)", "g", "12-ab and 7-cd");
  assert.equal(r.ok, true);
  assert.deepEqual(r.matches.map((m) => m.text), ["12-ab", "7-cd"]);
  assert.deepEqual(r.matches[0].groups, ["12", "ab"]);
  assert.equal(r.matches[1].named.word, "cd");
  assert.equal(r.matches[1].index, 10);
});

test("regex-search: invalid patterns are refused with a sentence in both languages and never throw", () => {
  for (const bad of ["(", "[a-", "a**", "\\", "(?<n>a)(?<n>b)"]) {
    const c = compile(bad, "");
    assert.equal(c.ok, false, bad);
    assert.ok(c.error.en && c.error.yue, bad);
  }
  assert.equal(compile("", "").empty, true);
  assert.equal(compile("a".repeat(MAX_PATTERN + 1), "").ok, false);
});

test("regex-search: Unicode and multiline text behave as the engine defines", () => {
  assert.deepEqual(runMatches("\\p{L}+", "gu", "wifi 路由器 ok").matches.map((m) => m.text), ["wifi", "路由器", "ok"]);
  assert.equal(runMatches("^b", "gm", "a\nb\nc").matches.length, 1);
  assert.equal(runMatches("a.b", "s", "a\nb").matches.length, 1);
  assert.equal(runMatches("a.b", "", "a\nb").matches.length, 0);
  assert.equal(runMatches("😀", "gu", "x😀y😀").matches.length, 2);
});

test("regex-search: an empty-match pattern terminates and a huge result set is capped", () => {
  assert.equal(runMatches("x*", "g", "abc").matches.length, 4);
  const r = runMatches("a", "g", "a".repeat(5000));
  assert.equal(r.matches.length, MAX_MATCHES);
  assert.equal(r.truncated, true);
});

test("regex-search: adversarial patterns that can run for ever are refused up front", () => {
  for (const evil of ["(a+)+$", "(a*)*b", "(\\w+\\s?)*$", "(a|a)+"]) {
    assert.ok(riskOf(evil), evil);
    const r = runMatches(evil, "", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!");
    assert.equal(r.ok, false);
    assert.equal(r.refused, true);
  }
  assert.equal(riskOf("(abc)+"), null, "an ordinary repeated group is fine");
  assert.equal(matcher({ mode: "regex", pattern: "(a+)+$" }).test("aaa"), false);
  assert.ok(matcher({ mode: "regex", pattern: "(a+)+$" }).error);
});

test("regex-search: replacement previews $1, $<name>, $&, $$ and is bounded", () => {
  assert.equal(replaceText("(\\w+)@(\\w+)", "g", "pat@home alex@work", "$2:$1").text, "home:pat work:alex");
  assert.equal(replaceText("(?<a>\\d)", "g", "1 2", "[$<a>]").text, "[1] [2]");
  assert.equal(replaceText("b", "g", "abc", "<$&>$$").text, "a<b>$c");
  assert.equal(replaceText("(", "g", "x", "y").ok, false);
  assert.equal(replaceText("a", "g", "aaa", "").count, 3);
});

test("regex-search: the matcher used by search boxes is plain by default and honours regex mode and flags", () => {
  assert.equal(matcher({ query: "Guest" }).test("a guest network"), true);
  assert.equal(matcher({ query: "" }).test("anything"), true);
  assert.equal(matcher({ mode: "regex", pattern: "^wi-?fi$", flags: "i" }).test("Wi-Fi"), true);
  assert.equal(matcher({ mode: "regex", pattern: "^wi-?fi$", flags: "" }).test("Wi-Fi"), false);
  // A search text holds several parts on separate lines; an anchored pattern is tested against each part.
  assert.equal(matcher({ mode: "regex", pattern: "^wi-?fi$", flags: "i" }).test("Wi-Fi\n路由器\nwl0_ssid"), true);
  assert.equal(matcher({ mode: "regex", pattern: "^路由器$" }).test("Wi-Fi\n路由器"), true);
  const broken = matcher({ mode: "regex", pattern: "(" });
  assert.equal(broken.test("x"), false);
  assert.ok(broken.error);
  assert.equal(cleanFlags("gigx"), "gi");
  assert.equal(cleanFlags("v"), "", "the v flag is not offered");
});

test("regex-search: the explanation tree describes each part and nests groups", () => {
  const tree = explain("^(?<ip>\\d{1,3}(?:\\.\\d+)*)$");
  const flat = JSON.stringify(tree);
  assert.match(flat, /start of the text/);
  assert.match(flat, /a group named \\"ip\\"/);
  assert.match(flat, /1 to 3 times/);
  assert.match(flat, /a group that does not capture/);
  assert.match(flat, /yue/);
  assert.ok(tree.find((n) => n.children?.length), "a group has children");
  assert.match(JSON.stringify(explain("a|b")), /"or"/);
  assert.ok(explain("(").length >= 1, "an unfinished pattern still explains what it can");
});

test("regex-search: palette tokens and samples are themselves valid patterns", () => {
  for (const s of SAMPLES) {
    const r = runMatches(s.pattern, s.flags, s.text);
    assert.equal(r.ok, true, s.id);
    assert.ok(r.matches.length >= 1, `${s.id} matches its own sample text`);
  }
  assert.ok(TOKENS.length >= 4);
});

test("regex-search: the ledger is honest about unfinished topics and the engine it is bound to", () => {
  assert.match(ENGINE, /ECMAScript/);
  const unfinished = LEDGER.filter((l) => l.state === "unfinished").map((l) => l.topic);
  for (const topic of ["flavour-comparison", "flavour-conversion", "tracing", "benchmarking", "code-generation", "safe-grep"]) assert.ok(unfinished.includes(topic), topic);
  assert.ok(UNSUPPORTED.length >= 5);
  for (const u of UNSUPPORTED) assert.ok(u.en && u.yue);
  assert.ok(LEDGER.filter((l) => l.state === "done").length >= 6);
});

test("regex-search: the module is listed, styled and well formed", async () => {
  await assertModuleListed("regex-search", feature, { style: true });
  assert.ok(feature.overlays.some((o) => o.id === "regex-search.attach"));
});
