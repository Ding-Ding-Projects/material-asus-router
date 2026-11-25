// Shared set-up for the navigation feature tests: the real catalogue entries
// of a stock and a Merlin router, and a check that a feature's browser module
// is listed by the server and well formed.
import assert from "node:assert/strict";
import { checkFeatureModule } from "../public/js/features/validate.js";
import { startApp } from "./helpers.mjs";

export async function catalogs() {
  const out = {};
  for (const firmware of ["merlin", "stock"]) {
    const t = await startApp({ firmware });
    try {
      out[firmware] = (await t.owner.get("/api/catalog")).data;
    } finally {
      await t.stop();
    }
  }
  return out;
}

// Every entry of both routers, each once per firmware.
export async function allEntries() {
  const c = await catalogs();
  return [...c.merlin.entries, ...c.stock.entries];
}

export async function assertModuleListed(id, feature, { style = false } = {}) {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes(`/js/features/${id}/index.js`), `${id} is listed in the manifest`);
    assert.equal((await fetch(`${t.base}/js/features/${id}/index.js`)).status, 200);
    if (style) {
      assert.ok(manifest.styles.includes(`/js/features/${id}/style.css`), `${id} has its stylesheet listed`);
      assert.equal((await fetch(`${t.base}/js/features/${id}/style.css`)).status, 200);
    }
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, id), null);
}
