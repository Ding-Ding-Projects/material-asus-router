// Notes in the change history for things that are not settings: a command that
// can affect the network, a file that was edited, a file that was deleted. They
// show up on the Change history screen beside the settings changes. They have
// the status "recorded", so there is nothing to undo from there.
import { randomUUID } from "node:crypto";

// Only this feature's own notes are ever dropped, never a settings change (those can hold vault secrets).
const KEEP_MINE = 100;
const mine = (h) => h.items?.[0]?.key === "flash-backup-action";

export async function record(app, { user, risk = "low", label, detail, note }) {
  const id = randomUUID();
  const entry = { id, at: new Date().toISOString(), user: user ?? "", status: "recorded", risk, restarts: [], guard: null, undoOf: null, note: note ?? undefined, items: [{ key: "flash-backup-action", entryId: null, label, secret: false, risk, old: null, new: String(detail).slice(0, 400) }] };
  await app.store.update((s) => {
    s.history.unshift(entry);
    const own = s.history.filter(mine);
    for (const old of own.slice(KEEP_MINE).reverse()) s.history.splice(s.history.indexOf(old), 1);
  });
  return id;
}

export async function amend(app, id, patch) {
  await app.store.update((s) => {
    const entry = s.history.find((h) => h.id === id);
    if (!entry) return;
    const { detail, ...rest } = patch;
    Object.assign(entry, rest);
    if (detail !== undefined && entry.items[0]) entry.items[0].new = String(detail).slice(0, 400);
  });
}
