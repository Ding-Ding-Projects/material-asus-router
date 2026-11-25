// Presets for editors that open empty, as plain data. No imports.
// Each preset says what it creates; the address always comes from a device
// that is really connected, never a made-up one.

const pair = (en, yue) => ({ en, yue });

export const FORWARD_FIELDS = ["name", "extPort", "ip", "intPort", "proto", "srcIp"];
export const RESERVE_FIELDS = ["mac", "ip", "hostname"];

export const FORWARD_PRESETS = [
  { id: "web", label: pair("Web server (HTTP)", "網頁伺服器（HTTP）"), values: { name: "Web server", extPort: "80", intPort: "80", proto: "TCP" }, says: pair("Sends outside port 80 to port 80 on the chosen device, over TCP.", "將外部 80 端口轉去所揀裝置嘅 80 端口（TCP）。") },
  { id: "https", label: pair("Secure web (HTTPS)", "安全網頁（HTTPS）"), values: { name: "Secure web", extPort: "443", intPort: "443", proto: "TCP" }, says: pair("Sends outside port 443 to port 443 on the chosen device, over TCP.", "將外部 443 端口轉去所揀裝置嘅 443 端口（TCP）。") },
  { id: "ssh", label: pair("Remote shell (SSH)", "遠端終端（SSH）"), values: { name: "SSH", extPort: "22", intPort: "22", proto: "TCP" }, says: pair("Sends outside port 22 to port 22 on the chosen device, over TCP. Only open this if you need it.", "將外部 22 端口轉去所揀裝置嘅 22 端口（TCP）。需要先開。") },
  { id: "minecraft", label: pair("Block game server", "方塊遊戲伺服器"), values: { name: "Game server", extPort: "25565", intPort: "25565", proto: "TCP" }, says: pair("Sends outside port 25565 to port 25565 on the chosen device, over TCP.", "將外部 25565 端口轉去所揀裝置嘅 25565 端口（TCP）。") },
  { id: "rdp", label: pair("Remote desktop", "遠端桌面"), values: { name: "Remote desktop", extPort: "3389", intPort: "3389", proto: "TCP" }, says: pair("Sends outside port 3389 to port 3389 on the chosen device, over TCP.", "將外部 3389 端口轉去所揀裝置嘅 3389 端口（TCP）。") },
  { id: "range", label: pair("Game ports (a range)", "遊戲端口（範圍）"), values: { name: "Game ports", extPort: "27015:27030", intPort: "27015", proto: "BOTH" }, says: pair("Sends outside ports 27015 to 27030 to the chosen device, over TCP and UDP.", "將外部 27015 至 27030 端口轉去所揀裝置（TCP 同 UDP）。") },
];

// The values a preset would put in the empty form. device may be null when none is connected.
export function forwardFill(preset, device) {
  return { name: preset.values.name, extPort: preset.values.extPort, ip: device?.ip ?? "", intPort: preset.values.intPort, proto: preset.values.proto, srcIp: "" };
}

// Reserve this device's current address so it always gets the same one.
export function reserveFill(device) {
  return { mac: device.mac, ip: device.ip, hostname: device.hostname ?? "" };
}
export const reserveSays = (device) => pair(`Reserves ${device.ip} for ${device.name} (${device.mac}) so it always gets the same address.`, `為 ${device.name}（${device.mac}）留住 ${device.ip}，令佢每次都攞到同一個地址。`);

export const EDITORS = {
  forward: { titles: ["New forwarding rule", "新增轉發規則"], fields: FORWARD_FIELDS },
  reserve: { titles: ["Reserve an address", "留住一個地址"], fields: RESERVE_FIELDS },
};

// Which editor a dialog title belongs to, in either language.
export function editorFor(title) {
  const text = String(title ?? "");
  return Object.entries(EDITORS).find(([, e]) => e.titles.some((x) => text.includes(x)))?.[0] ?? null;
}

// A recorded preset action: what was in the form before and after, so it can be undone.
export const record = (editor, preset, before, after, at = new Date().toISOString()) => ({ at, editor, preset, before, after });
export const undoValues = (entry) => entry.before;
