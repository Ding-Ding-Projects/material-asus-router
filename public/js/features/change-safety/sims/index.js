// One call draws the right before-and-after picture for a change.
import { mountSim } from "./core.js";
import { buildScene } from "./scenes.js";
import { simKind } from "../model.js";

// `change` is a preview item or a history change: { key, label, old, new, secret?, area? }.
export function sceneData(change, all = []) {
  const label = typeof change.label === "string" ? { en: change.label, yue: change.label } : (change.label ?? { en: change.key, yue: change.key });
  const mask = (v) => (change.secret ? "••••••••" : v);
  return { key: String(change.key ?? ""), area: change.area ?? "", old: mask(change.old ?? ""), new: mask(change.new ?? ""), name: { en: label.en ?? change.key, yue: label.yue ?? label.en ?? change.key }, all: all.map((c) => ({ key: c.key, old: c.old, new: c.new })) };
}

export function simulateChange(host, change, { all = [] } = {}) {
  const kind = change.secret ? "generic" : simKind(change);
  const def = buildScene(kind, sceneData(change, all));
  const mounted = mountSim(host, def);
  host.dataset.simKind = kind;
  return mounted;
}
