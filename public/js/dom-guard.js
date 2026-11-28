// The app passes "nothing here" as null, undefined or false, the way its element builder accepts
// it. The browser's own append() and its relatives would print those as the words "null",
// "undefined" or "false" on the page, and would turn a list into text. This drops the nothings
// and unpacks lists before the browser sees them. It is applied once, before anything is drawn.
const METHODS = ["append", "prepend", "replaceChildren", "after", "before", "replaceWith"];

export const realNodes = (items) => items.flat(Infinity).filter((item) => item !== null && item !== undefined && item !== false);

export function dropNothing(proto) {
  for (const name of METHODS) {
    const original = proto?.[name];
    if (typeof original !== "function" || original.dropsNothing) continue;
    const guarded = function (...items) {
      return original.apply(this, realNodes(items));
    };
    guarded.dropsNothing = true;
    proto[name] = guarded;
  }
}

for (const kind of ["Element", "Document", "DocumentFragment", "CharacterData"]) dropNothing(globalThis[kind]?.prototype);
