// The table of control types the settings rows can draw. controls.js draws
// the stock types itself and asks this table for every other type, so a
// feature can add a control from its own folder:
//
//   import { registerControl } from "/js/control-registry.js";
//   registerControl("thermostat", (entry, current, commit, locked, ctx) => ({ el, sync }));
//
// current() returns the value as a string, commit(string) records an edit in
// the pending-changes dock, locked is true when the person may not edit, and
// the returned sync() redraws the control after an edit is undone.
export const controlTypes = new Map();

export function registerControl(type, factory) {
  if (typeof type !== "string" || typeof factory !== "function") throw new Error("registerControl(type, factory) needs a name and a function");
  controlTypes.set(type, factory);
}
