// Web access: how the router's own web page can be opened. Automatic sign-out,
// the list of addresses allowed to open it, Let's Encrypt, the certificate
// read-out with its expiry, and a clear red view of whether the page is open
// to the internet.
//
// Some settings here belong to other screens and are only shown with their
// current value (the internet switch, the ports and the protocol). Every setting
// of this feature is a typed control over a real nvram value; one the router
// does not have is shown locked with the reason and is never written.
import { L, ON_OFF, quote } from "../kit.mjs";
import { CLIENT_PATTERN, clientItems, isAllowedClient, parseCertificate } from "./cert.mjs";

const ID = "web-access";
const G = {
  session: L("Signing in", "登入"),
  allow: L("Who may open the page", "邊個可以開頁面"),
  tls: L("Certificate (HTTPS)", "證書（HTTPS）"),
  wan: L("From the internet", "由互聯網"),
};
const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${ID}.${id}`, domain: ID, group, groupLabel: G[group], key, control, label, help, risk: "low", restart: "restart_httpd", ...extra });
const CERT_FILE = "/etc/cert.pem";

export const catalog = () => [
  e("autologout", "session", "http_autologout", "stepper", L("Sign out automatically after (minutes)", "閒置幾多分鐘後自動登出"), L("The router's page signs you out when nobody touches it. 0 keeps you signed in, which is not advised on a shared computer.", "冇人操作嘅時候，路由器頁面會自動登出。0 代表唔會登出，共用電腦唔建議。"), { min: 0, max: 480, unit: "min" }),
  e("clientlist", "allow", "http_clientlist", "clientlist", L("Addresses allowed to open the page", "容許開頁面嘅地址"), L("When the list is switched on in System tools, only these addresses can open the router's page. Add your own address first, or you lock yourself out; the safety net would put it back.", "喺系統工具開咗名單之後，只有呢啲地址開到路由器頁面。要先加你自己嘅地址，否則會鎖住自己；安全網會幫你還原。"), { optional: true, risk: "network", maxItems: 16, columns: [{ kind: "client", label: L("Address", "地址"), maxLength: 18, pattern: CLIENT_PATTERN }] }),
  e("le.enable", "tls", "le_enable", "switch", L("Free certificate from Let's Encrypt", "Let's Encrypt 免費證書"), L("Gets a trusted certificate so browsers stop warning about the router's HTTPS page. It needs a name from Dynamic DNS that points to this router.", "攞一張可信嘅證書，瀏覽器就唔會再警告路由器嘅 HTTPS 頁面。需要一個指向呢部路由器嘅動態 DNS 名稱。"), { values: ON_OFF, restart: "restart_letsencrypt", risk: "network" }),
  e("le.domain", "tls", "le_domain", "hostname", L("Name for the certificate", "證書用嘅名稱"), L("The Dynamic DNS name the certificate is made for, for example router.example.test.", "證書針對嘅動態 DNS 名稱，例如 router.example.test。"), { optional: true, restart: "restart_letsencrypt" }),
  e("le.staging", "tls", "le_staging", "switch", L("Practice mode (no real certificate)", "練習模式（唔會攞真證書）"), L("Uses the Let's Encrypt practice server, so a mistake does not count against the weekly limit. The certificate it gives is not trusted by browsers.", "用 Let's Encrypt 嘅練習伺服器，打錯嘢唔會用咗每週名額。佢畀嘅證書瀏覽器唔會信。"), { values: ON_OFF, restart: "restart_letsencrypt" }),
  e("wan.port", "wan", "misc_httpport_x", "port", L("Port used from the internet", "由互聯網用嘅端口"), L("Only matters while the router page is open to the internet, which is off by default and should stay off.", "只有路由器頁面對互聯網開放時先有作用；預設係關，亦應該保持關。"), { min: 1, max: 65535, risk: "network" }),
];

// The settings other screens own, passed along read-only so this screen can show the whole picture.
const RELATED = ["sys.webport", "sys.remoteweb", "system-pro.https.mode", "system-pro.https.port", "system-pro.remote.port", "system-pro.remote.restrict"];

const bad = (message, status = 400) => Object.assign(new Error(message), { status });

// A setting this router does not have is shown locked with the reason.
const missing = (entries, nvram) => entries.map((entry) => (entry.disabled || nvram.has(entry.key) ? entry : { ...entry, disabled: { en: `This router does not have the setting ${entry.key}`, yue: `呢部路由器冇 ${entry.key} 呢個設定` } }));

// The address list is stored as "<a<b". A custom control keeps the format exact.
const clientlist = {
  validate(entry, text, fail) {
    if (text === "") return "";
    if (!text.startsWith("<")) fail("write the list as <address<address.");
    const items = clientItems(text);
    if (items.length > (entry.maxItems ?? 16)) fail(`use at most ${entry.maxItems ?? 16} addresses.`);
    if (new Set(items).size !== items.length) fail("remove the repeated address.");
    for (const item of items) if (!isAllowedClient(item)) fail(`"${item}" is not an address or a network of /8 or smaller.`);
    return text;
  },
  sample: (_entry, current) => ["<198.51.100.20", "<198.51.100.20<198.51.100.0/24"].find((v) => v !== current) ?? "<198.51.100.21",
  invalid: () => "<999.1.1.1",
};

async function readCertificate(exec) {
  const out = await exec(`openssl x509 -in ${quote(CERT_FILE)} -noout -subject -issuer -enddate`);
  if (out.code === 127) return { found: false, reason: "openssl is not available on this router." };
  if (out.code !== 0) return { found: false, reason: "The router has no certificate file to read." };
  const parsed = parseCertificate(out.stdout);
  return parsed.found ? parsed : { found: false, reason: "The certificate could not be read." };
}

export default {
  id: ID,
  catalog,
  controls: { clientlist },
  domainMeta: [{ id: ID, icon: "language", label: L("Web access", "網頁存取"), group: { en: "Router", yue: "路由器" }, live: true }],
  domains: {
    [ID]: async (ctx) => {
      const get = (key) => ctx.nvram.get(key) ?? "";
      const related = [...ctx.entries("system"), ...ctx.entries("system-pro")].filter((x) => RELATED.includes(x.id));
      return {
        entries: missing(ctx.entries(), ctx.nvram),
        related,
        internet: { open: get("misc_http_x") === "1", port: Number(get("misc_httpport_x")) || 8443, onlyListed: get("http_client") === "1" },
        protocol: get("http_enable"),
        certificate: await readCertificate(ctx.exec),
      };
    },
  },
  routes(api) {
    api.get("/certificate", async ({ live }) => readCertificate((await live()).exec));
    // Adds one address to the allowed list as a reviewed preview.
    api.post("/allow", async ({ body, live, preview }) => {
      const address = String(body.address ?? "");
      if (!isAllowedClient(address) || address.includes("/")) throw bad("That is not an address.");
      const items = clientItems((await live()).nvram.get("http_clientlist"));
      if (items.includes(address)) throw bad("That address is already on the list.", 409);
      return preview({ changes: [{ id: `${ID}.clientlist`, value: `<${[...items, address].join("<")}` }] });
    });
  },
  fakeRouter: {
    nvram: { http_autologout: "30", http_clientlist: "<198.51.100.20", le_enable: "0", le_domain: "", le_staging: "0", misc_httpport_x: "8443" },
    handlers: [
      (command) => {
        if (command !== "openssl x509 -in '/etc/cert.pem' -noout -subject -issuer -enddate") return undefined;
        const end = new Date(Date.now() + 70 * 86400000);
        const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][end.getUTCMonth()];
        const pad = (n) => String(n).padStart(2, "0");
        return { stdout: `subject=CN = router.example.test\nissuer=C = US, O = Let's Encrypt, CN = R11\nnotAfter=${month} ${String(end.getUTCDate()).padStart(2, " ")} ${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}:${pad(end.getUTCSeconds())} ${end.getUTCFullYear()} GMT\n` };
      },
    ],
  },
};
