// The "wifi-maclist" control: a list of MAC addresses shown as chips with the
// device's name beside each, an add box that formats as you type, a picker for
// the devices the router already knows, and a button that adds every device
// currently connected to the band. The value is the router's own format:
// "<AA:BB:CC:DD:EE:FF<11:22:33:44:55:66".
//
// It imports nothing; everything arrives in the arguments.
const MAC = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/;
const MAX = 64;

export const parseList = (text) => String(text ?? "").split("<").map((s) => s.trim().toUpperCase()).filter(Boolean);
export const formatList = (items) => items.map((m) => `<${m}`).join("");
const formatMac = (raw) => (raw.replace(/[^0-9a-fA-F]/g, "").toUpperCase().slice(0, 12).match(/.{1,2}/g) ?? []).join(":");

let devicesLoad = null;
const knownDevices = (api) => (devicesLoad ??= api.get("/api/domain/devices").then((d) => d.devices ?? []).catch(() => []));

export function maclistControl(entry, current, commit, locked, ctx) {
  const { h, icon, t } = ctx;
  const band = String(entry.key).match(/^wl(\d+)_/)?.[1] ?? "0";
  const names = new Map();
  const holder = h("div", { class: "chips ml-chips" });
  const count = h("div", { class: "t2" });
  const items = () => parseList(current());
  const write = (list) => { commit(formatList(list)); draw(); };
  const add = (mac) => {
    const value = formatMac(mac);
    if (!MAC.test(value)) return false;
    const list = items();
    if (list.includes(value) || list.length >= MAX) return false;
    write([...list, value]);
    return true;
  };

  const draw = () => {
    const list = items();
    holder.replaceChildren(...list.map((mac) =>
      h("span", { class: "chip on ml-chip" },
        h("span", { class: "mono" }, mac), names.get(mac) ? h("span", { class: "muted" }, ` ${names.get(mac)}`) : null,
        locked ? null : h("button", { class: "x", type: "button", "aria-label": `${t("Remove", "移除")} ${mac}`, onClick: () => write(list.filter((m) => m !== mac)) }, icon("close", "sm")))));
    if (!list.length) holder.append(h("span", { class: "muted" }, t("The list is empty.", "名單係空嘅。")));
    count.textContent = t(`${list.length} of ${MAX} devices`, `${list.length} / ${MAX} 部裝置`);
    if (picker) {
      for (const option of [...picker.options].slice(1)) option.disabled = list.includes(option.value);
    }
  };

  const input = h("input", { class: "field mono", autocomplete: "off", spellcheck: "false", maxlength: "17", placeholder: "AA:BB:CC:DD:EE:FF", disabled: locked, "aria-label": t("Type a MAC address", "打一個 MAC 地址"),
    onInput(e) { e.target.value = formatMac(e.target.value); e.target.setAttribute("aria-invalid", String(e.target.value !== "" && !MAC.test(e.target.value))); },
    onKeydown(e) { if (e.key === "Enter") { e.preventDefault(); if (add(input.value)) input.value = ""; } } });
  const addButton = h("button", { class: "btn o sm", type: "button", disabled: locked, onClick() { if (add(input.value)) input.value = ""; else ctx.toast(t("Enter a new MAC address such as AA:BB:CC:DD:EE:FF.", "請輸入一個新嘅 MAC 地址，例如 AA:BB:CC:DD:EE:FF。"), "warn"); } }, icon("add", "sm"), t("Add", "加入"));
  const picker = h("select", { class: "field", disabled: locked, "aria-label": t("Add a known device", "加入已知裝置"), onChange(e) { add(e.target.value); e.target.value = ""; } }, h("option", { value: "" }, t("Pick a device…", "揀裝置…")));
  const connected = h("button", { class: "btn t sm", type: "button", disabled: locked, async onClick() {
    try {
      const out = await ctx.api.get(`/api/x/wifi-wps-macfilter/connected/${band}`);
      const before = items().length;
      for (const mac of out.macs) add(mac);
      ctx.toast(t(`${items().length - before} connected devices added.`, `已加入 ${items().length - before} 部已連接嘅裝置。`));
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
  } }, icon("devices", "sm"), t("Add devices connected now", "加入而家連緊嘅裝置"));
  const clear = h("button", { class: "btn t sm", type: "button", disabled: locked, onClick: () => write([]) }, icon("delete", "sm"), t("Clear the list", "清空名單"));

  knownDevices(ctx.api).then((list) => {
    for (const d of list) {
      const mac = String(d.mac).toUpperCase();
      names.set(mac, d.customName || d.name || "");
      picker.append(h("option", { value: mac }, `${d.name || mac} · ${mac}`));
    }
    draw();
  });
  draw();
  return {
    el: h("div", { class: "ml" }, holder, count, h("div", { class: "ml-add" }, input, addButton), picker, h("div", { class: "ml-tools" }, connected, clear)),
    sync: draw,
  };
}

