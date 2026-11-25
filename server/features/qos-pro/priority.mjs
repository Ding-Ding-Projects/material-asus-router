// The "priority-order" control: Adaptive QoS keeps its traffic groups as one
// ordered list, "9,20<4<0,5,6,15,17<8<13,24<1,3,14<7,10,11,21,23". Groups are
// joined with "<" and run from the most important first to the least; each
// group is a set of application category numbers joined with ",".
export const DEFAULT_ORDER = "9,20<4<0,5,6,15,17<8<13,24<1,3,14<7,10,11,21,23";
const MAX_GROUPS = 8;

export function parseOrder(text) {
  if (text === "") return null;
  const groups = text.split("<").map((group) => (group === "" ? null : group.split(",")));
  return groups.length <= MAX_GROUPS && groups.every((g) => g && g.every((id) => /^\d{1,2}$/.test(id) && Number(id) <= 63)) ? groups : null;
}

export const priorityOrder = {
  validate(_entry, text, fail) {
    const groups = parseOrder(text);
    if (!groups) fail(`use between 1 and ${MAX_GROUPS} groups joined with <, each a list of category numbers joined with commas.`);
    const ids = groups.flat();
    if (new Set(ids).size !== ids.length) fail("a category can only be in one group.");
    return groups.map((g) => g.join(",")).join("<");
  },
  sample(_entry, current) {
    const groups = parseOrder(current) ?? parseOrder(DEFAULT_ORDER);
    const text = (list) => list.map((g) => g.join(",")).join("<");
    const candidates = [text([...groups].reverse()), text([...groups.slice(1), groups[0]]), DEFAULT_ORDER, "1<2"];
    return candidates.find((c) => c !== current);
  },
  invalid: () => "a<b",
};
