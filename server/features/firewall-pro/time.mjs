// Two small controls for the firewall filters' schedules, in the router's own
// forms: "weekdays" is seven 0 or 1 flags, Sunday first ("1111111"), and
// "timerange" is a start and an end as HHMMHHMM ("00002359").
const other = (candidates, current) => candidates.find((c) => c !== current) ?? candidates[0];

const hours = (text) => {
  const h = Number(text.slice(0, 2));
  const m = Number(text.slice(2, 4));
  return h < 24 && m < 60 ? h * 60 + m : null;
};

export const weekdays = {
  validate(_entry, text, fail) {
    if (!/^[01]{7}$/.test(text)) fail("choose the days, Sunday first, as seven 0 or 1 flags such as 0111110.");
    return text;
  },
  sample: (_entry, current) => other(["1111111", "0111110", "1000001"], current),
  invalid: () => "12",
};

export const timerange = {
  validate(entry, text, fail) {
    if (entry.optional && text === "") return "";
    const ok = /^\d{8}$/.test(text);
    const [start, end] = ok ? [hours(text.slice(0, 4)), hours(text.slice(4))] : [null, null];
    if (!ok || start === null || end === null || start >= end) fail("enter a start and an end time as HHMMHHMM, with the start first, such as 08001700.");
    return text;
  },
  sample: (_entry, current) => other(["08001700", "18002200", "00002359"], current),
  invalid: () => "25009999",
};
