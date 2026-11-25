// The AiMesh screen: one card per node with its backhaul, its connected
// devices, a friendly name, light control and a restart behind a super confirm.
import { createUi } from "./ui.js";

const label = { en: "AiMesh nodes", yue: "AiMesh 節點" };
const lede = { en: "The main router and the nodes that extend it, with what is connected to each.", yue: "主路由器同擴展覆蓋嘅節點，仲有每個節點連住嘅裝置。" };

function nodeCard(ctx, ui, node, data, refresh) {
  const { h, t, icon, api, toast } = ctx;
  const title = node.alias || (node.role === "router" ? t("Main router", "主路由器") : node.mac);
  const run = async (name, body, keysOptions) => {
    const keys = keysOptions ? await ui.superConfirm(keysOptions) : {};
    if (!keys) return;
    try {
      const out = await api.post(`/api/actions/aimesh-pro.${name}`, { ip: node.ip, ...body, ...keys });
      toast(out.message, out.ok ? "" : "bad");
    } catch (error) {
      toast(error.message, "bad");
    }
    refresh();
  };
  const rename = () => ui.form({
    title: t(`Name for ${title}`, `${title} 嘅名稱`),
    intro: t("Leave empty to remove the name.", "留空就移除名稱。"),
    fields: [{ name: "name", label: { en: "Name", yue: "名稱" }, value: node.alias, maxlength: 32 }],
    submitLabel: t("Preview", "預覽"),
    async submit(values) {
      const preview = await api.post(`/api/x/aimesh-pro/nodes/${encodeURIComponent(node.mac)}/alias`, { name: values.name });
      setTimeout(async () => ((await ui.review(preview, { title: t("Name this node", "俾節點改名") }).closed) && refresh()), 0);
    },
  });
  const canAct = ctx.state.canWrite && node.role === "node" && node.ip;
  return ui.card(
    h("div", { class: "mesh-node" },
      h("div", { class: "row" }, icon(node.role === "router" ? "router" : "device_hub"), h("div", { class: "grow" }, h("h2", { class: "h2" }, title), h("div", { class: "t2 mono" }, node.mac, node.ip ? ` · ${node.ip}` : "")),
        h("span", { class: `tag ${node.role === "router" ? "good" : ""}` }, node.role === "router" ? t("Main router", "主路由器") : t("Node", "節點")),
        ctx.state.canWrite ? h("button", { class: "btn t icon", "aria-label": t(`Rename ${title}`, `改名：${title}`), onClick: rename }, icon("edit", "sm")) : null),
      node.role === "node" ? h("div", { class: "row" }, icon("cable"), h("div", { class: "grow" }, h("div", { class: "k" }, t("Backhaul", "回程連線")), h("div", { class: "t1" }, node.backhaul ? node.backhaul : t("Not reported by the firmware", "韌體冇提供"))), node.backhaul ? null : h("span", { class: "tag" }, t("In progress", "進行中"))) : null,
      h("div", { class: "k" }, t(`Connected devices: ${node.clients.length}`, `連住嘅裝置：${node.clients.length}`)),
      node.clients.length
        ? h("div", { class: "mesh-clients" }, node.clients.map((c) => h("div", { class: "row" }, icon(c.via === "wired" ? "lan" : "wifi", "sm"), h("div", { class: "grow" }, h("div", { class: "t1" }, c.name || c.mac), h("div", { class: "t2 mono" }, c.ip || c.mac)), h("span", { class: "tag" }, c.via), c.rssi === null ? null : h("span", { class: "t2" }, `${c.rssi} dBm`))))
        : h("div", { class: "t2" }, data.clientsKnown ? t("Nothing is connected to this one.", "冇裝置連住呢個。") : t("The router did not list devices per node.", "路由器冇按節點列出裝置。")),
      canAct
        ? h("div", { class: "actions" },
          h("button", { class: "btn t sm", onClick: () => run("node-led", { off: true }, { title: t("Turn off the light on this node?", "關閉呢個節點嘅燈？"), body: t("The node light switches off until you turn it on again. The command is sent from the main router, so SSH must be on for the node.", "節點嘅燈會熄，直至你再開。指令由主路由器發出，所以節點要開咗 SSH。"), action: t("Turn off", "關燈"), typeModel: false }) }, icon("lightbulb", "sm"), t("Light off", "關燈")),
          h("button", { class: "btn t sm", onClick: () => run("node-led", { off: false }, { title: t("Turn on the light on this node?", "開返呢個節點嘅燈？"), body: t("The node light switches on.", "節點嘅燈會亮。"), action: t("Turn on", "開燈"), typeModel: false }) }, icon("light_mode", "sm"), t("Light on", "開燈")),
          h("button", { class: "btn d sm", onClick: () => run("reboot-node", {}, { title: t(`Restart ${title}?`, `重啟 ${title}？`), body: t("Everything connected to this node goes offline for a few minutes and moves to the other nodes.", "連住呢個節點嘅裝置會離線幾分鐘，並轉去其他節點。"), action: t("Restart node", "重啟節點") }) }, icon("restart_alt", "sm"), t("Restart node", "重啟節點")))
        : null));
}

async function draw(ctx, root) {
  const ui = createUi(ctx);
  const data = await ctx.api.get("/api/domain/aimesh-pro");
  const page = ctx.page(label, lede);
  root.replaceChildren(page);
  const refresh = () => draw(ctx, root);
  page.append(...ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)));
  page.append(data.nodes.length ? ctx.h("div", { class: "grid" }, data.nodes.map((n) => nodeCard(ctx, ui, n, data, refresh))) : ui.card(ui.empty(ctx.t("No AiMesh nodes are set up yet.", "未設定任何 AiMesh 節點。"))));
}

export default {
  id: "aimesh-pro",
  screens: [
    {
      id: "aimesh-pro",
      group: { en: "Network", yue: "網絡" },
      icon: "device_hub",
      label,
      async render(ctx) {
        await draw(ctx, ctx.root);
        return ctx.bus.on("changed", () => draw(ctx, ctx.root));
      },
    },
  ],
  settings: [
    {
      id: "aimesh-pro",
      icon: "device_hub",
      label,
      async render(ctx) {
        const data = await ctx.api.get("/api/domain/aimesh-pro");
        return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries));
      },
    },
  ],
  commands: [
    { id: "aimesh-pro.open", icon: "device_hub", label: { en: "Open AiMesh nodes", yue: "開啟 AiMesh 節點" }, keywords: "aimesh mesh node backhaul restart led", run: (ctx) => ctx.navigate("aimesh-pro") },
  ],
};
