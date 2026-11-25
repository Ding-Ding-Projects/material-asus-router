// Pointer dragging for the visual editors. The same file sits in every editor's
// folder, because a feature folder imports nothing from outside itself.
//
// `draggable(el, options)` makes `el` draggable with a mouse, pen or finger.
// A drag starts after the pointer moves a few pixels, so a plain click still
// clicks. While dragging, a ghost copy follows the pointer and the drop target
// under it (an element found by options.zones()) gets the class "drop-hot".
// Escape cancels. Every editor also offers a keyboard route to the same result,
// because dragging alone would shut keyboard users out.
export const DRAG_START = 6;

// The first zone rectangle that contains the point, or null.
export function hitZone(zones, x, y) {
  return zones.find((z) => x >= z.left && x <= z.right && y >= z.top && y <= z.bottom) ?? null;
}

export function draggable(el, { zones, onDrop, onMove, enabled = () => true, ghostClass = "drag-ghost" }) {
  let start = null;
  let ghost = null;
  let hot = null;
  let swallow = false;

  const rects = () => zones().map((node) => ({ node, ...node.getBoundingClientRect().toJSON() }));
  const setHot = (node) => {
    if (hot === node) return;
    hot?.classList.remove("drop-hot");
    hot = node;
    hot?.classList.add("drop-hot");
  };
  const finish = (drop) => {
    const target = hot;
    setHot(null);
    ghost?.remove();
    ghost = null;
    el.classList.remove("is-dragged");
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("keydown", key, true);
    start = null;
    // A click that follows a drag arrives right after; later clicks are ordinary again.
    setTimeout(() => (swallow = false), 60);
    if (drop && target) onDrop(target, el);
  };
  const move = (e) => {
    if (!start) return;
    if (!ghost) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_START) return;
      ghost = el.cloneNode(true);
      ghost.classList.add(ghostClass);
      ghost.removeAttribute("id");
      ghost.setAttribute("aria-hidden", "true");
      ghost.style.width = `${el.getBoundingClientRect().width}px`;
      document.body.append(ghost);
      el.classList.add("is-dragged");
      swallow = true;
    }
    ghost.style.left = `${e.clientX + 8}px`;
    ghost.style.top = `${e.clientY + 8}px`;
    const found = hitZone(rects(), e.clientX, e.clientY);
    setHot(found?.node ?? null);
    onMove?.(found?.node ?? null);
  };
  const up = () => finish(Boolean(ghost));
  const key = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      finish(false);
    }
  };
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !enabled()) return;
    start = { x: e.clientX, y: e.clientY };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("keydown", key, true);
  });
  // A drag must not also count as a click on the card it started from.
  el.addEventListener(
    "click",
    (e) => {
      if (!swallow) return;
      swallow = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    },
    true,
  );
  el.addEventListener("dragstart", (e) => e.preventDefault());
  el.style.touchAction = "none";
}
