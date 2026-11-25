// The action catalogue screen. See server/features/ssh-actions for the rules
// behind every card: typed parameters, the exact command, the safety net and
// the confirmations.
import { drawCatalogue } from "./cards.js";
import { openProcesses } from "./processes.js";

const label = { en: "Action catalogue", yue: "動作目錄" };
const lede = { en: "Everything this app can do over SSH, as a card: choose the options, see the exact command, and watch it run.", yue: "呢個程式可以經 SSH 做嘅每樣嘢都係一張卡：揀選項、睇確實命令、即時睇住佢執行。" };
const group = { en: "Power tools", yue: "進階工具" };

export default {
  id: "ssh-actions",
  screens: [{ id: "ssh-actions", group, icon: "terminal", label, render: (ctx) => drawCatalogue(ctx, ctx.root, { title: label, lede }) }],
  commands: [
    { id: "ssh-actions.open", icon: "terminal", label, keywords: "ssh action commands services restart ping traceroute usb swap cron files", run: (ctx) => ctx.navigate("ssh-actions") },
    { id: "ssh-actions.processes", icon: "memory", label: { en: "Show running processes", yue: "顯示運行緊嘅程序" }, keywords: "process ps stop kill", run: (ctx) => { ctx.navigate("ssh-actions"); setTimeout(() => openProcesses(ctx), 400); } },
    { id: "ssh-actions.files", icon: "folder_open", label: { en: "Browse the router's files", yue: "瀏覽路由器檔案" }, keywords: "files jffs tmp opt edit upload download", run: (ctx) => { ctx.navigate("ssh-actions"); setTimeout(() => document.getElementById("sa-files")?.scrollIntoView({ block: "start" }), 600); } },
  ],
};
