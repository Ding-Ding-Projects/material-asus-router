// Presets for blank-slate editors. When the port forwarding or reserved
// address editor opens empty, a row of presets appears above it. Each states
// what it creates, uses a really connected device for the address, and is a
// recorded action with its own Undo (and a log in Feature settings). The
// preset only fills the form: nothing reaches the router until you add the
// rule to the changes bar and apply it.
import { FORWARD_PRESETS, editorFor, forwardFill, record, reserveFill, reserveSays, EDITORS } from "./presets.js";

const KEY = "mar.nav.presets";
const kv = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function fieldsOf(dialog) {
  return [...dialog.querySelectorAll(".two input.field, .two select.field")];
}
function readValues(fields, names) {
  return Object.fromEntries(names.map((n, i) => [n, fields[i]?.value ?? ""]));
}
function writeValues(fields, names, values) {
  names.forEach((n, i) => {
    const el = fields[i];
    if (!el || values[n] === undefined) return;
    el.value = values[n];
    el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}

async function decorate(ctx, dialog) {
  if (dialog.dataset.beDone) return;
  const editor = editorFor(dialog.querySelector("h2")?.textContent);
  if (!editor) return;
  const fields = fieldsOf(dialog);
  if (!fields.length || fields.some((f) => f.value && f.tagName === "INPUT" && f.value !== "")) return; // only a blank editor
  dialog.dataset.beDone = "1";
  const { h, icon, t, tt } = ctx;
  const names = EDITORS[editor].fields;
  let devices = [];
  try { devices = (await ctx.api.get("/api/domain/devices")).devices.filter((d) => d.ip); } catch {}
  let device = devices[0] ?? null;
  const says = h("div", { class: "t2", role: "status" });
  const undo = h("button", { type: "button", class: "btn o sm", disabled: true }, icon("undo", "sm"), t("Undo preset", "還原預設"));
  let last = null;
  const apply = (preset, values, text) => {
    const before = readValues(fields, names);
    writeValues(fields, names, values);
    last = record(editor, preset, before, values);
    kv.set(KEY, [last, ...kv.get(KEY, [])].slice(0, 50));
    says.textContent = text;
    undo.disabled = false;
  };
  undo.addEventListener("click", () => { if (!last) return; writeValues(fields, names, last.before); says.textContent = t("Preset undone. The form is back as it was.", "已還原預設，表單回到原本。"); last = null; undo.disabled = true; });
  const bar = h("div", { class: "be-bar" }, h("div", { class: "k" }, t("Start from a preset", "由預設開始")));
  if (editor === "forward") {
    const pick = devices.length ? h("select", { class: "field", "aria-label": t("Device the rule sends to", "規則轉發去嘅裝置"), onChange: (e) => { device = devices.find((d) => d.mac === e.target.value) ?? null; } }, devices.map((d) => h("option", { value: d.mac }, `${d.name} · ${d.ip}`))) : h("div", { class: "t2" }, t("No connected device found, so the address stays empty.", "搵唔到已連線裝置，所以地址留空。"));
    bar.append(pick, h("div", { class: "chips" }, FORWARD_PRESETS.map((p) => h("button", { type: "button", class: "chip", title: tt(p.says), onClick: () => apply(p.id, forwardFill(p, device), tt(p.says)) }, tt(p.label)))));
  } else {
    bar.append(devices.length ? h("div", { class: "chips" }, devices.slice(0, 10).map((d) => h("button", { type: "button", class: "chip", title: tt(reserveSays(d)), onClick: () => apply(`device:${d.mac}`, reserveFill(d), tt(reserveSays(d))) }, icon("devices", "sm"), `${d.name} · ${d.ip}`))) : h("div", { class: "t2" }, t("No connected device to start from.", "冇已連線裝置可以揀。")));
  }
  bar.append(says, undo);
  dialog.querySelector("h2")?.after(bar);
}

export default {
  id: "blank-editors",
  overlays: [
    {
      id: "blank-editors.dialogs",
      mount(ctx) {
        const observer = new MutationObserver((records) => { for (const r of records) for (const n of r.addedNodes) if (n.nodeName === "DIALOG") setTimeout(() => decorate(ctx, n), 0); });
        observer.observe(document.body, { childList: true });
        return () => observer.disconnect();
      },
    },
  ],
  settings: [
    {
      id: "blank-editors",
      icon: "playlist_add",
      label: { en: "Preset history", yue: "預設記錄" },
      render(ctx) {
        const { h, t } = ctx;
        const items = kv.get(KEY, []);
        return items.length ? h("div", {}, items.slice(0, 15).map((i) => h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t1" }, `${i.editor === "forward" ? t("Port forwarding", "端口轉發") : t("Reserved address", "留住地址")}: ${i.preset}`), h("div", { class: "t2" }, new Date(i.at).toLocaleString()))))) : h("div", { class: "t2" }, t("No preset has been used yet.", "未用過任何預設。"));
      },
    },
  ],
};
