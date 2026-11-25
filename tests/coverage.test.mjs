// How much of a real router the controls cover. The count is taken against the RT-BE88U profile, whose setting
// names are those of a real router, so it moves only when a control is added or removed on purpose. Before the
// controls were aligned with this router, 404 of its 5,497 settings had a control; every control that
// writes a setting this router lacks is now shown switched off instead of being counted.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { startApp } from "./helpers.mjs";

test("the controls cover a stated share of the real router's settings, and none of them are made up", async () => {
  const profile = JSON.parse(await readFile(new URL("../server/ssh/profiles/rt-be88u-merlin-3006.json", import.meta.url), "utf8"));
  const names = new Set(profile.names);
  const t = await startApp({ profile: "rt-be88u-merlin-3006" });
  try {
    const entries = await t.app.session.catalog({ fresh: true });
    const covered = new Set(entries.filter((e) => names.has(e.key)).map((e) => e.key));
    const usable = new Set(entries.filter((e) => !e.disabled).map((e) => e.key));
    const missing = entries.filter((e) => !names.has(e.key));
    assert.ok(missing.every((e) => e.disabled), "a control for a setting this router lacks is always switched off");
    assert.ok([...usable].every((k) => names.has(k)), "every available control writes a setting that the router has");
    assert.ok(covered.size >= 690, `${covered.size} of ${names.size} settings have a control`);
    assert.ok(covered.size <= names.size);
    console.log(`coverage: ${covered.size} of ${names.size} settings of the RT-BE88U have a control (${((100 * covered.size) / names.size).toFixed(1)} per cent); ${missing.length} controls are switched off because this router lacks their setting`);
  } finally {
    await t.stop();
  }
});
