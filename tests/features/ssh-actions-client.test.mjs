// The browser-side pieces of the action catalogue that need no page to be
// tested: the highlighter, the checks behind each control and the job follower.
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMac, problemWith } from "../../public/js/features/ssh-actions/controls.js";
import { followJob } from "../../public/js/features/ssh-actions/follow.js";
import { highlight, languageOf } from "../../public/js/features/ssh-actions/highlight.js";

test("ssh-actions client: the highlighter always gives back exactly the text it was given", () => {
  const samples = {
    shell: "#!/bin/sh\n# comment with 'quote\nif [ -n \"$VAR\" ]; then\n  echo \"hi ${NAME}\" 'single'\nfi\nx=\"unterminated\n",
    json: '{"a": [1, 2.5e3, true, null], "b": {"c": "d\\"e"}, "bad": "open\n',
    conf: "# c\nkey=value\n ; other\nport = 8080\n[section]\n",
    plain: "anything at all\n\t\n",
  };
  for (const [lang, text] of Object.entries(samples)) assert.equal(highlight(text, lang).map((t) => t.text).join(""), text, lang);
  const kinds = (text, lang) => highlight(text, lang).filter((t) => t.cls).map((t) => [t.cls, t.text]);
  assert.deepEqual(kinds("# hi", "shell"), [["cm", "# hi"]]);
  assert.deepEqual(kinds('echo "x" $HOME', "shell"), [["str", '"x"'], ["var", "$HOME"]]);
  assert.deepEqual(kinds("if x; then", "shell").map((k) => k[1]), ["if", ";", "then"]);
  assert.deepEqual(kinds('{"k": 1}', "json"), [["op", "{"], ["key", '"k"'], ["op", ":"], ["num", "1"], ["op", "}"]]);
  assert.deepEqual(kinds("a=1", "conf"), [["key", "a"], ["op", "="], ["num", "1"]]);
  assert.equal(languageOf("/jffs/scripts/x"), "shell");
  assert.equal(languageOf("/tmp/a.json"), "json");
  assert.equal(languageOf("/jffs/configs/dnsmasq.conf.add"), "conf");
  assert.equal(languageOf("/tmp/x.txt", "#!/bin/sh\n"), "shell");
  assert.equal(languageOf("/tmp/x.txt", "hello"), "plain");
});

test("ssh-actions client: every kind of control says what is wrong with a value", () => {
  const t = (en) => en;
  const num = { type: "number", min: 1, max: 9, required: true };
  assert.equal(problemWith(num, "4", t), "");
  assert.match(problemWith(num, "10", t), /whole number from 1 to 9/);
  assert.match(problemWith(num, "2.5", t), /whole number/);
  assert.match(problemWith(num, "", t), /Choose or enter/);
  assert.equal(problemWith({ type: "number", min: 1, max: 9 }, "", t), "", "an optional empty value is fine");
  assert.equal(problemWith({ type: "host" }, "example.com", t), "");
  assert.equal(problemWith({ type: "host" }, "203.0.113.5", t), "");
  assert.match(problemWith({ type: "host" }, "a b", t), /host name/);
  assert.match(problemWith({ type: "host" }, "x;reboot", t), /host name/);
  assert.equal(problemWith({ type: "mac" }, "AA:BB:CC:DD:EE:FF", t), "");
  assert.match(problemWith({ type: "mac" }, "AA:BB", t), /AA:BB:CC:DD:EE:FF/);
  assert.equal(formatMac("aabbccddeeff"), "AA:BB:CC:DD:EE:FF");
  assert.equal(formatMac("zz-12.34"), "12:34");
  assert.equal(problemWith({ type: "name", pattern: "^[a-z-]{1,8}$" }, "ok-name", t), "");
  assert.match(problemWith({ type: "name", pattern: "^[a-z-]{1,8}$" }, "Not OK", t), /letters/);
  for (const ok of ["*", "0", "*/5", "1-5", "1,15,30", "*/15,3"]) assert.equal(problemWith({ type: "cronfield" }, ok, t), "", ok);
  for (const bad of ["a", "1 2", "*/", ";", "1,,2"]) assert.notEqual(problemWith({ type: "cronfield" }, bad, t), "", bad);
  const key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl laptop@example";
  assert.equal(problemWith({ type: "pubkey" }, key, t), "");
  assert.match(problemWith({ type: "pubkey" }, "hello", t), /not a public SSH key/);
});

test("ssh-actions client: following a job asks for what is new, survives a blip and stops when the job is final", async () => {
  const script = [
    { next: 1, status: "running", chunks: [{ n: 0, stream: "note", text: "start\n" }] },
    Object.assign(new Error("blip"), { status: 502 }),
    { next: 3, status: "running", chunks: [{ n: 1, stream: "out", text: "a" }, { n: 2, stream: "out", text: "b" }] },
    { next: 3, status: "done", chunks: [], finishedAt: "x" },
  ];
  const asked = [];
  const api = {
    get: async (url) => {
      asked.push(url);
      const step = script.shift();
      if (step instanceof Error) throw step;
      return step;
    },
  };
  const seen = [];
  const states = [];
  const f = followJob({ api, base: "/b", id: "J", wait: 1000, onChunks: (c) => seen.push(...c.map((x) => x.text)), onState: (r) => states.push(r.status), sleep: async () => {} });
  const final = await f.done;
  assert.equal(final.status, "done");
  assert.deepEqual(seen, ["start\n", "a", "b"]);
  assert.deepEqual(asked, ["/b/jobs/J?from=0&wait=1000", "/b/jobs/J?from=1&wait=1000", "/b/jobs/J?from=1&wait=1000", "/b/jobs/J?from=3&wait=1000"], "each request continues where the last one ended");
  assert.deepEqual(states, ["running", "waiting", "running", "done"]);

  const gone = followJob({ api: { get: async () => { throw Object.assign(new Error("no"), { status: 404 }); } }, base: "/b", id: "X", sleep: async () => {} });
  assert.equal((await gone.done).status, "lost");

  const endless = followJob({ api: { get: async () => ({ next: 1, status: "running", chunks: [] }) }, base: "/b", id: "Y", sleep: async () => {} });
  endless.stop();
  assert.equal(await endless.done, null, "stopping ends the loop without a result");
});
