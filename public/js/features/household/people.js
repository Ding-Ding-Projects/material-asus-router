// The people in the household: name, devices, a weekly schedule painted on a
// grid, what each of them puts up with, and the Home Assistant entities that
// say whether they are home. Only the owner can change anything here.
import { api, clear, h, icon, t, tt, toast } from "../../core.js";
import { BRUSHES, DAYS, KINDS, LEVEL_WORDS, blocksFromGrid, gridFromBlocks, gridSummary, hourText, paintRect } from "./model.js";

const errText = (e) => e?.message ?? String(e);
const levelOptions = (selected, { follow = false } = {}) => [
  follow ? h("option", { value: "", selected: selected === null || selected === undefined }, t("Follow the household setting", "跟屋企設定")) : null,
  ...LEVEL_WORDS.map((w, i) => h("option", { value: String(i), selected: selected === i }, tt(w))),
];

export function memberCard(member, { owner, devices, entities, presets, reload }) {
  const draft = JSON.parse(JSON.stringify(member));
  let grid = gridFromBlocks(draft.schedule);
  let brush = "work";
  let dragFrom = null;
  const card = h("section", { class: "card rise member", "data-member": member.id });
  const gridHost = h("div", { class: "sg-wrap" });
  const summary = h("div", { class: "t2", "aria-live": "polite" });

  const drawGrid = () => {
    clear(gridHost);
    const head = h("div", { class: "sg-row sg-head" }, h("span", { class: "sg-day" }), Array.from({ length: 24 }, (_, hr) => h("span", { class: "sg-hr", "aria-hidden": "true" }, hr % 3 === 0 ? String(hr) : "")));
    const rows = DAYS.map((d) => h("div", { class: "sg-row", role: "row" }, h("span", { class: "sg-day" }, t(d.en, d.yue)),
      grid[d.id].map((kind, hr) => {
        const cell = h("button", { type: "button", class: `sg-cell ${kind ? `k-${kind}` : ""}`, disabled: !owner, "data-day": String(d.id), "data-hour": String(hr), role: "gridcell",
          "aria-label": `${t(d.en, d.yue)} ${hourText(hr)} ${kind ? tt(KINDS[kind]) : t("empty", "空")}`,
          onPointerdown: (e) => { if (!owner) return; e.preventDefault(); dragFrom = { day: d.id, hour: hr }; paint({ day: d.id, hour: hr }); },
          onPointerenter: (e) => { if (dragFrom && e.buttons === 1) paint({ day: d.id, hour: hr }); },
          onKeydown: (e) => keyNav(e, d.id, hr) });
        return cell;
      })));
    gridHost.append(h("div", { class: "sg", role: "grid", "aria-label": t(`Weekly schedule for ${draft.name}`, `${draft.nameYue || draft.name}嘅每週時間表`) }, head, rows));
    const s = gridSummary(grid);
    clear(summary).append(t(`Painted: ${s.work} h at work, ${s.sleep} h sleeping, ${s.home} h at home. Anything not painted counts as at home.`, `已畫：返工 ${s.work} 小時、瞓覺 ${s.sleep} 小時、喺屋企 ${s.home} 小時。冇畫嘅時間當係喺屋企。`));
  };
  const paint = (cell) => {
    grid = paintRect(grid, cell, cell, brush);
    drawGrid();
  };
  const keyNav = (e, day, hr) => {
    const move = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key];
    if (move) {
      e.preventDefault();
      const nd = Math.min(6, Math.max(0, day + move[0]));
      const nh = Math.min(23, Math.max(0, hr + move[1]));
      gridHost.querySelector(`[data-day="${nd}"][data-hour="${nh}"]`)?.focus();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      grid = paintRect(grid, { day, hour: hr }, { day, hour: hr }, brush);
      drawGrid();
      gridHost.querySelector(`[data-day="${day}"][data-hour="${hr}"]`)?.focus();
    }
  };
  const stopDrag = () => { dragFrom = null; };
  card.addEventListener("pointerup", stopDrag);
  card.addEventListener("pointerleave", stopDrag);

  const nameInput = h("input", { type: "text", maxlength: "60", value: draft.name, disabled: !owner, "aria-label": t("Name", "名稱"), onInput: (e) => (draft.name = e.target.value) });
  const nameYue = h("input", { type: "text", maxlength: "60", value: draft.nameYue, disabled: !owner, "aria-label": t("Cantonese name", "廣東話名稱"), onInput: (e) => (draft.nameYue = e.target.value) });

  const deviceChips = h("div", { class: "chips" });
  const drawDevices = () => clear(deviceChips).append(...[...draft.devices.map((d) => h("span", { class: "chip" }, icon("devices", "sm"), d.label, owner ? h("button", { class: "chip-x", "aria-label": `${t("Remove", "移除")} ${d.label}`, onClick: () => { draft.devices = draft.devices.filter((x) => x.mac !== d.mac); drawDevices(); } }, icon("close", "sm")) : null)), draft.devices.length ? null : h("span", { class: "muted" }, t("No devices yet. Pick the phone or laptop that tells us they are home.", "仲未有裝置。揀一部手機或者電腦，我哋靠佢知道佢喺唔喺屋企。"))].flat().filter(Boolean));
  const picker = h("select", { disabled: !owner, "aria-label": t("Add a device", "加裝置") }, h("option", { value: "" }, t("Add a device…", "加裝置…")), devices.filter((d) => !draft.devices.some((x) => x.mac === d.mac)).map((d) => h("option", { value: d.mac }, `${d.name || d.mac} · ${d.mac}${d.wireless ? "" : ` · ${t("wired", "有線")}`}`)));
  picker.addEventListener("change", () => {
    const d = devices.find((x) => x.mac === picker.value);
    if (d) { draft.devices.push({ mac: d.mac, label: d.name || d.mac }); drawDevices(); picker.value = ""; picker.querySelector(`option[value="${d.mac}"]`)?.remove(); }
  });

  const entityChips = h("div", { class: "chips" });
  const drawEntities = () => clear(entityChips).append(...draft.haEntities.map((e) => h("span", { class: "chip" }, icon("home_iot_device", "sm"), e.name || e.entityId, owner ? h("button", { class: "chip-x", "aria-label": `${t("Remove", "移除")} ${e.entityId}`, onClick: () => { draft.haEntities = draft.haEntities.filter((x) => x.entityId !== e.entityId); drawEntities(); } }, icon("close", "sm")) : null)));
  const entityPick = h("select", { disabled: !owner || !entities.length, "aria-label": t("Add a Home Assistant entity", "加 Home Assistant 實體") }, h("option", { value: "" }, entities.length ? t("Add a Home Assistant entity…", "加 Home Assistant 實體…") : t("Connect Home Assistant first", "請先連接 Home Assistant")), entities.map((e) => h("option", { value: e.entityId }, `${e.name || e.entityId} · ${e.entityId}`)));
  entityPick.addEventListener("change", () => {
    const e = entities.find((x) => x.entityId === entityPick.value);
    if (e && !draft.haEntities.some((x) => x.entityId === e.entityId)) { draft.haEntities.push({ entityId: e.entityId, name: e.name || e.entityId }); drawEntities(); }
    entityPick.value = "";
  });

  const lvSelect = (label, get, set, follow) => h("label", { class: "field" }, h("span", {}, label), h("select", { disabled: !owner, onChange: (e) => set(e.target.value === "" ? null : Number(e.target.value)) }, levelOptions(get(), { follow })));

  const presetButtons = presets.map((p) => h("button", { type: "button", class: "btn t sm", disabled: !owner, onClick: () => {
    const b = p.block;
    for (const day of b.days) grid = paintRectBlock(grid, day, b);
    drawGrid();
  } }, icon("auto_awesome", "sm"), tt(p.label)));
  const brushes = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Brush", "畫筆") }, BRUSHES.map((b) => h("button", { type: "button", role: "radio", "aria-checked": String(brush === b), class: brush === b ? "on" : "", disabled: !owner, onClick: (e) => { brush = b; [...e.currentTarget.parentNode.children].forEach((x) => { x.classList.toggle("on", x === e.currentTarget); x.setAttribute("aria-checked", String(x === e.currentTarget)); }); } }, b === "erase" ? [icon("ink_eraser", "sm"), t("Erase", "擦走")] : [icon(KINDS[b].icon, "sm"), tt(KINDS[b])])));

  const save = h("button", { class: "btn f", disabled: !owner, onClick: async () => {
    save.disabled = true;
    try {
      draft.schedule = blocksFromGrid(grid, draft.allowances);
      await api.patch(`/api/household/members/${member.id}`, { name: draft.name, nameYue: draft.nameYue, devices: draft.devices, schedule: draft.schedule, allowances: draft.allowances, homeAllowance: draft.homeAllowance, awayAllowance: draft.awayAllowance, haEntities: draft.haEntities });
      toast(t("Saved.", "已儲存。"));
      reload();
    } catch (error) {
      toast(errText(error), "bad");
      save.disabled = !owner;
    }
  } }, icon("save", "sm"), t("Save this person", "儲存呢個人"));

  card.append(
    h("div", { class: "member-head" }, icon("person", "lg"), h("div", { class: "grow" }, h("h2", { class: "h2" }, tt({ en: member.name, yue: member.nameYue || member.name })), h("div", { class: "t2" }, member.id === "brother" ? t("The first person in the household.", "屋企第一個人。") : "")),
      owner && member.id !== "brother" ? h("button", { class: "btn o sm", onClick: async () => { try { await api.del(`/api/household/members/${member.id}`); reload(); } catch (error) { toast(errText(error), "bad"); } } }, icon("delete", "sm"), t("Remove", "移除")) : null),
    h("div", { class: "grid2" }, h("label", { class: "field" }, h("span", {}, t("Name", "名稱")), nameInput), h("label", { class: "field" }, h("span", {}, t("Cantonese name", "廣東話名稱")), nameYue)),
    h("h3", { class: "k" }, t("Devices that say they are home", "代表佢喺屋企嘅裝置")),
    h("p", { class: "t2" }, t("We only look at which home Wi-Fi network a device is connected to right now. No pings, no address tracking, no location, nothing is kept.", "我哋只睇裝置而家連住邊個屋企 Wi-Fi。唔 ping、唔追蹤地址、唔記錄位置，亦唔會儲存任何嘢。")),
    deviceChips, picker,
    h("h3", { class: "k" }, t("Home Assistant entities (optional)", "Home Assistant 實體（可選）")), entityChips, entityPick,
    h("h3", { class: "k" }, t("Weekly schedule", "每週時間表")),
    h("p", { class: "t2" }, t("Paint when they are at work, asleep or at home. Drag across the grid, or use the arrow keys and press Space.", "畫出佢幾時返工、瞓覺或者喺屋企。喺格仔上拖動，或者用方向鍵再撳空白鍵。")),
    brushes, h("div", { class: "chips" }, presetButtons), gridHost, summary,
    h("h3", { class: "k" }, t("What they put up with", "佢可以接受幾多")),
    h("div", { class: "grid4" },
      lvSelect(t("At work", "返工時"), () => draft.allowances.work, (v) => (draft.allowances.work = v ?? 3), false),
      lvSelect(t("Sleeping", "瞓覺時"), () => draft.allowances.sleep, (v) => (draft.allowances.sleep = v ?? 0), false),
      lvSelect(t("At home", "喺屋企時"), () => draft.allowances.home, (v) => (draft.allowances.home = v), true),
      lvSelect(t("Cap while home", "喺屋企嘅上限"), () => draft.homeAllowance, (v) => (draft.homeAllowance = v), true),
      lvSelect(t("While away", "唔喺屋企時"), () => draft.awayAllowance, (v) => (draft.awayAllowance = v ?? 3), false)),
    owner ? h("div", { class: "actions" }, save) : h("div", { class: "muted" }, t("Only the owner can change the household.", "只有擁有人可以修改屋企設定。")));
  drawGrid();
  drawDevices();
  drawEntities();
  return card;
}

// Paints one preset block onto one day, with overnight blocks spilling into the next day.
function paintRectBlock(grid, day, block) {
  const next = grid.map((row) => row.slice());
  const from = Number(block.from.slice(0, 2));
  const to = Number(block.to.slice(0, 2));
  const overnight = to <= from;
  if (!overnight) for (let hr = from; hr < to; hr += 1) next[day][hr] = block.kind;
  else {
    for (let hr = from; hr < 24; hr += 1) next[day][hr] = block.kind;
    for (let hr = 0; hr < to; hr += 1) next[(day + 1) % 7][hr] = block.kind;
  }
  return next;
}

