// A multi-select model for lists: click toggles, shift-click selects a range,
// the keyboard works on rows (Space toggles, Shift+Arrow extends), "page"
// select-all covers the visible rows and "matches" select-all covers every row
// that matches the current filter. This file is copied unchanged into the
// feature folders that need a list (a feature imports only its own folder).
export function createSelection() {
  const chosen = new Set();
  let anchor = null;
  return {
    chosen,
    get size() {
      return chosen.size;
    },
    has: (id) => chosen.has(id),
    clear() {
      chosen.clear();
      anchor = null;
    },
    // visible is the ordered list of ids on the page.
    toggle(id, visible, { shift = false } = {}) {
      if (shift && anchor !== null && visible.includes(anchor)) {
        const a = visible.indexOf(anchor);
        const b = visible.indexOf(id);
        for (const x of visible.slice(Math.min(a, b), Math.max(a, b) + 1)) chosen.add(x);
      } else {
        if (chosen.has(id)) chosen.delete(id);
        else chosen.add(id);
        anchor = id;
      }
    },
    selectAll(ids) {
      ids.forEach((id) => chosen.add(id));
    },
    invert(ids) {
      for (const id of ids) {
        if (chosen.has(id)) chosen.delete(id);
        else chosen.add(id);
      }
    },
    // Drops ids that no longer exist (after a delete).
    keepOnly(ids) {
      const live = new Set(ids);
      for (const id of [...chosen]) if (!live.has(id)) chosen.delete(id);
    },
  };
}

// The words for what "select all" will do, so the scope is never a surprise.
export function scopeText(t, pageCount, matchCount) {
  return {
    page: t(`Select the ${pageCount} on this page`, `選取本頁 ${pageCount} 項`),
    matches: t(`Select all ${matchCount} that match`, `選取全部 ${matchCount} 項符合嘅`),
  };
}
