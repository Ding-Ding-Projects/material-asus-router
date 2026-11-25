// Pure helpers for the rule canvas: port ranges, protocol overlap and conflicts.

// "8080" or "8000:8010" as [from, to], or null when it is not a valid port or range.
export function parsePort(text) {
  const m = String(text ?? "").trim().match(/^(\d{1,5})(?::(\d{1,5}))?$/);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = m[2] === undefined ? lo : Number(m[2]);
  return lo >= 1 && hi <= 65535 && lo <= hi ? [lo, hi] : null;
}

export const portText = ([lo, hi]) => (lo === hi ? String(lo) : `${lo}:${hi}`);

// BOTH covers TCP and UDP, so it overlaps with either.
export const protoOverlap = (a, b) => a === "BOTH" || b === "BOTH" || a === b;

export const rangesOverlap = (a, b) => a[0] <= b[1] && b[0] <= a[1];

// Every pair of things that want the same port from the internet:
//   { kind: "forward-forward", a, b }       two forwarding rules (their positions)
//   { kind: "forward-service", rule, service }  a rule on a port the router itself offers to the internet
// A forwarding rule limited to different source addresses does not conflict.
export function findConflicts(rules, services) {
  const out = [];
  const ranges = rules.map((r) => parsePort(r.extPort));
  for (let a = 0; a < rules.length; a += 1) {
    if (!ranges[a]) continue;
    for (let b = a + 1; b < rules.length; b += 1) {
      if (!ranges[b] || !protoOverlap(rules[a].proto, rules[b].proto) || !rangesOverlap(ranges[a], ranges[b])) continue;
      if (rules[a].srcIp && rules[b].srcIp && rules[a].srcIp !== rules[b].srcIp) continue;
      out.push({ kind: "forward-forward", a, b });
    }
    for (const service of services) {
      if (service.wan && protoOverlap(rules[a].proto, service.proto) && rangesOverlap(ranges[a], [service.port, service.port])) out.push({ kind: "forward-service", rule: a, service: service.id });
    }
  }
  return out;
}

// Which rules (by position) take part in any conflict.
export const conflictedRules = (conflicts) => new Set(conflicts.flatMap((c) => (c.kind === "forward-forward" ? [c.a, c.b] : [c.rule])));

// A rule's problems that are not conflicts: a bad port, or a device nobody knows at that address.
export function problemsOf(rule, devices) {
  const out = [];
  if (!parsePort(rule.extPort)) out.push("ext-port");
  if (!parsePort(rule.intPort)) out.push("int-port");
  if (!devices.some((d) => d.ip === rule.ip)) out.push("unknown-device");
  return out;
}

// The groups the device lane draws: every known device, then the addresses rules point at that no device owns.
export function laneRows(devices, rules) {
  const rows = devices.map((d) => ({ ip: d.ip, name: d.name, known: true }));
  for (const ip of new Set(rules.map((r) => r.ip))) if (ip && !rows.some((r) => r.ip === ip)) rows.push({ ip, name: ip, known: false });
  return rows;
}
