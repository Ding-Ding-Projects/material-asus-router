// Pure helpers for the Guest Network Pro screen, kept apart so Node tests can
// check them. They read the router's list settings ("<a>b>c<d>e>f") and join
// each guest Wi-Fi to the separate network, VLAN and addresses it uses.

export const rows = (text) => String(text ?? "").split("<").filter(Boolean).map((row) => row.split(">"));

const BRIDGE_NAME = { br0: { en: "Home network", yue: "屋企網絡" }, br1: { en: "Guest network 1", yue: "訪客網絡 1" }, br2: { en: "Guest network 2", yue: "訪客網絡 2" }, br3: { en: "Guest network 3", yue: "訪客網絡 3" } };
export const bridgeName = (id) => BRIDGE_NAME[id] ?? { en: id, yue: id };

// One line per guest Wi-Fi: its name, where it lands, the VLAN and addresses.
export function guestMap(nets, vlans, subnets, counts = new Map(), pending = new Map()) {
  const vlanBy = new Map(rows(vlans).map((r) => [r[2], { name: r[0], vid: Number(r[1]) }]));
  const subnetBy = new Map(rows(subnets).map((r) => [r[0], { gateway: r[1], mask: r[2], dhcp: r[3] === "1", lease: Number(r[4]) }]));
  return nets.map((net) => {
    const bridge = pending.get(`${net.id}_brif`) ?? net.bridge;
    const isolate = (pending.get(`${net.id}_ap_isolate`) ?? (net.isolate ? "1" : "0")) === "1";
    const separate = bridge !== "br0";
    return {
      id: net.id, ssid: net.ssid, on: net.on, bridge, separate, isolate,
      vlan: separate ? vlanBy.get(bridge) ?? null : null,
      subnet: separate ? subnetBy.get(bridge) ?? null : null,
      clients: counts.get(net.id) ?? 0,
      // What a person should do next, in plain words, as an id the screen words.
      advice: !net.on ? "off" : !separate ? "shared" : !isolate ? "visible" : "safe",
    };
  });
}

// "255.255.255.0" -> 24
export function prefixOf(mask) {
  const bits = String(mask).split(".").map((n) => Number(n).toString(2).padStart(8, "0")).join("");
  return /^1*0*$/.test(bits) && bits.length === 32 ? bits.indexOf("0") === -1 ? 32 : bits.indexOf("0") : null;
}

export const countsOf = (clients) => new Map((clients?.networks ?? []).map((n) => [n.id, n.count]));
