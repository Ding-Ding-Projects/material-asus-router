// AiMesh: the nodes that work with the main router, what is connected to each
// one, friendly names, the backhaul priority setting, and two node actions
// (light on or off, restart) sent from the main router over its own SSH
// client. Nothing about a node is guessed: a value the firmware does not
// report is shown as not reported.
import { L, cleanText, formatRows, isIpv4, isMac, macAddress, parseRows, quote } from "../kit.mjs";

const ID = "aimesh-pro";
const NOTE = L("This setting name is the one recent ASUS builds use; confirm it on your model after applying.", "呢個設定名稱係近期 ASUS 版本用嘅；套用後請喺你部機確認。");
const bad = (message, status = 400) => Object.assign(new Error(message), { status });

export const catalog = () => [
  { id: `${ID}.priority`, domain: ID, group: "backhaul", groupLabel: L("Backhaul", "回程連線"), key: "amas_ethernet", control: "select", risk: "network", restart: "", requires: "amas", meta: { note: NOTE },
    options: [["0", L("Automatic", "自動"), L("Wi-Fi or cable, whichever is best", "Wi-Fi 或網線，自動揀最好嘅")], ["1", L("Cable first", "優先用網線"), L("Nodes use a cable when one is plugged in", "有插網線嘅節點會用網線")]],
    label: L("Backhaul priority", "回程連線優先次序"), help: L("How nodes reach the main router. Changing it can drop a node for a minute; the safety net puts it back if the router stops answering.", "節點點樣連返主路由器。改咗可能令節點斷線一陣；如果路由器冇回應，安全機制會還原。") },
];

const BANDS = { wired_mac: "wired", "2G": "2.4 GHz", "5G": "5 GHz", "5G1": "5 GHz", "5G2": "5 GHz", "6G": "6 GHz" };
const BACKHAUL = { wired: "wired", "2g": "2.4 GHz", "5g": "5 GHz", "6g": "6 GHz" };

// The node list as the firmware keeps it: <mac>ip>backhaul mac>role[>backhaul type].
export function readNodes(nvram) {
  const names = new Map(parseRows(nvram.get("cfg_alias") ?? "").map((r) => [String(r[0] ?? "").toUpperCase(), r[1] ?? ""]));
  return parseRows(nvram.get("cfg_clientlist") ?? "")
    .filter((r) => isMac(r[0] ?? ""))
    .map((r) => {
      const mac = r[0].toUpperCase();
      const kind = String(r[4] ?? "").toLowerCase();
      return { mac, ip: isIpv4(r[1] ?? "") ? r[1] : "", role: r[3] === "0" ? "router" : "node", alias: names.get(mac) ?? "", backhaul: BACKHAUL[kind] ?? null };
    });
}

// The router's own client list, grouped by the node each device is attached to.
export function readClients(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const out = new Map();
  for (const [node, groups] of Object.entries(json ?? {})) {
    if (!isMac(node) || typeof groups !== "object" || groups === null) continue;
    const clients = [];
    for (const [group, members] of Object.entries(groups)) {
      if (!BANDS[group] || typeof members !== "object" || members === null) continue;
      for (const [mac, info] of Object.entries(members)) {
        if (!isMac(mac)) continue;
        const rssi = Number(info?.rssi);
        clients.push({ mac: mac.toUpperCase(), name: String(info?.name ?? info?.nickName ?? "").slice(0, 64), ip: isIpv4(info?.ip ?? "") ? info.ip : "", via: BANDS[group], rssi: Number.isFinite(rssi) && rssi < 0 ? rssi : null });
      }
    }
    out.set(node.toUpperCase(), clients);
  }
  return out;
}

// A command that runs one fixed remote command on a node through the main
// router's own SSH client. The address must be a node the router knows.
export function nodeCommand(nvram, ip, remote) {
  const node = readNodes(nvram).find((n) => n.ip === ip && n.role === "node");
  if (!node) throw bad("That address is not an AiMesh node of this router.", 404);
  const user = String(nvram.get("http_username") ?? "");
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(user)) throw bad("The router login name cannot be used to reach a node.", 409);
  return { node, command: `dbclient -y -l ${quote(user)} ${ip} ${quote(remote)}` };
}

export default {
  id: ID,
  catalog,
  domainMeta: [{ id: ID, icon: "hub", label: L("AiMesh nodes", "AiMesh 節點"), group: { en: "Network", yue: "網絡" }, requires: "amas", live: true }],
  domains: {
    [ID]: async (ctx) => {
      const nodes = readNodes(ctx.nvram);
      const out = await ctx.exec("head -n 100000 /tmp/clientlist.json");
      const clients = out.code === 0 ? readClients(out.stdout) : null;
      return {
        entries: ctx.entries(),
        clientsKnown: clients !== null,
        nodes: nodes.map((n) => ({ ...n, clients: clients?.get(n.mac) ?? [] })),
      };
    },
  },
  routes(api) {
    api.post("/nodes/:mac/alias", async ({ params, body, live, preview }) => {
      const mac = macAddress(decodeURIComponent(params.mac));
      const { nvram } = await live();
      if (!readNodes(nvram).some((n) => n.mac === mac)) throw bad("That node is not part of this AiMesh.", 404);
      const name = cleanText(body.name, "Node name", { max: 32, allowEmpty: true });
      const rows = parseRows(nvram.get("cfg_alias") ?? "").filter((r) => String(r[0] ?? "").toUpperCase() !== mac);
      if (name) rows.push([mac, name]);
      return preview({ changes: [{ key: "cfg_alias", value: formatRows(rows), risk: "low" }] });
    });
  },
  actions: {
    // Light on or off for one node. Sent from the main router over SSH, so the node needs SSH on.
    "node-led": {
      risk: "network",
      confirm: ["hold"],
      run: async ({ body, exec, nvram }) => {
        if (typeof body.off !== "boolean") throw bad("Say whether the light should be off.");
        if (!isIpv4(body.ip)) throw bad("Choose a node.");
        const { node, command } = nodeCommand(await nvram(), body.ip, `nvram set led_disable=${body.off ? 1 : 0}; nvram commit; service restart_leds`);
        const out = await exec(command, { timeoutMs: 20000 });
        return { ok: out.code === 0, mac: node.mac, off: body.off, message: out.code === 0 ? (body.off ? "The node light is off." : "The node light is on.") : "The node did not accept the command. Check that SSH is on for the node and that this router may sign in to it." };
      },
    },
    // Restarts one node. The node is away for a few minutes and its devices move to the other nodes.
    "reboot-node": {
      risk: "destructive",
      run: async ({ body, exec, nvram }) => {
        if (!isIpv4(body.ip)) throw bad("Choose a node.");
        const { node, command } = nodeCommand(await nvram(), body.ip, "reboot");
        const out = await exec(command, { timeoutMs: 20000 });
        return { ok: out.code === 0, mac: node.mac, message: out.code === 0 ? "The node is restarting. It can take a few minutes to rejoin." : "The node did not accept the command. Check that SSH is on for the node and that this router may sign in to it." };
      },
    },
  },
  fakeRouter: {
    nvram: { amas_ethernet: "0", cfg_alias: "<04:D9:F5:77:88:90>Hallway node" },
    handlers: [
      (command, router) => {
        if (command === "head -n 100000 /tmp/clientlist.json")
          return {
            stdout: JSON.stringify({
              "04:D9:F5:12:34:50": { wired_mac: { "B8:27:EB:11:22:33": { name: "nas", ip: "198.51.100.20" } }, "2G": { "3C:22:FB:10:20:30": { name: "kitchen-speaker", ip: "198.51.100.103", rssi: "-67" } }, "5G": { "AC:5A:F0:01:02:03": { name: "lgwebostv", ip: "198.51.100.101", rssi: "-48" }, "F0:18:98:AA:BB:01": { name: "Pats-iPhone", ip: "198.51.100.102", rssi: "-55" } } },
              "04:D9:F5:77:88:90": { wired_mac: {}, "2G": {}, "5G": { "DC:A6:32:44:55:66": { name: "printer", ip: "198.51.100.104", rssi: "-71" } } },
            }),
          };
        const sent = command.match(/^dbclient -y -l '([^']+)' (198\.51\.100\.\d+) '([^']+)'$/);
        if (sent) {
          (router.nodeCommands ??= []).push({ user: sent[1], ip: sent[2], remote: sent[3] });
          return { stdout: "" };
        }
        return undefined;
      },
    ],
  },
};
