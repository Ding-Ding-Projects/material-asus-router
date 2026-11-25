// The owner's terminal screen. See server/features/owner-terminal for the rules.
import { drawTerminal } from "./terminal.js";

const label = { en: "Terminal", yue: "終端機" };
const lede = { en: "A real shell on the router, inside the browser. Raw access for the owner only.", yue: "喺瀏覽器入面直接用路由器嘅 shell。只限擁有者使用嘅直接存取。" };
const group = { en: "Power tools", yue: "進階工具" };

export default {
  id: "owner-terminal",
  screens: [{ id: "owner-terminal", group, icon: "terminal", label, render: (ctx) => drawTerminal(ctx, ctx.root, { title: label, lede }) }],
  commands: [{ id: "owner-terminal.open", icon: "terminal", label: { en: "Open the terminal", yue: "開啟終端機" }, keywords: "ssh shell console command line raw", run: (ctx) => ctx.navigate("owner-terminal") }],
};
