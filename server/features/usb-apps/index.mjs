// USB apps: drives with disk usage and safe eject, Windows file sharing with
// accounts and per-share permissions, FTP, media server folders and the Time
// Machine size limit. Every setting is a typed control that reads its real
// nvram value; the account, share and folder lists are built by routes that
// return a reviewed preview, and nothing writes to the router outside the
// change engine except the eject action, which needs the hold button.
import { L, formatRows, parseRows, quote } from "../kit.mjs";

const ID = "usb-apps";
const NOTE = L("The layout of this setting follows recent ASUS builds; confirm on your model after applying.", "呢個設定嘅格式跟近期 ASUS 版本；套用後請喺你部機確認。");
const G = {
  samba: L("Windows file sharing", "Windows 檔案分享"),
  accounts: L("Sharing accounts", "分享帳戶"),
  ftp: L("FTP", "FTP"),
  media: L("Media server", "媒體伺服器"),
  tm: L("Time Machine", "Time Machine"),
};
const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${ID}.${id}`, domain: ID, group, groupLabel: G[group], key, control, label, help, risk: "low", requires: "usbX1", restart: "restart_nasapps", ...extra });

export const MOUNT = /^\/tmp\/mnt(?:\/[A-Za-z0-9 ._-]{1,64}){1,6}$/;
const NAME = /^[A-Za-z0-9._-]{1,20}$/;
const SHARE = /^[A-Za-z0-9._ -]{1,32}$/;
const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const safePath = (value) => {
  const text = String(value ?? "").trim().replace(/\/+$/, "");
  if (!MOUNT.test(text) || text.split("/").some((p) => p === "..")) throw bad("Choose a folder on a USB drive, such as /tmp/mnt/usb1/Music.");
  return text;
};

export const catalog = () => [
  e("samba.mode", "samba", "st_samba_mode", "select", L("Who can open the shares", "邊個可以開分享"), L("Choose whether anyone at home can open them or only the accounts below.", "揀屋企任何人都開到，定係淨係下面嘅帳戶先開到。"), { options: [["1", L("Anyone at home", "屋企任何人"), L("No sign-in", "唔使登入")], ["4", L("Only the accounts below", "只限下面嘅帳戶"), L("Sign-in required", "要登入")]], meta: { note: NOTE } }),
  e("samba.workgroup", "samba", "st_samba_workgroup", "text", L("Workgroup", "工作群組"), L("The Windows workgroup name. WORKGROUP is what most computers use.", "Windows 嘅工作群組名稱。大部分電腦都用 WORKGROUP。"), { freeText: true, freeTextReason: "A workgroup name is a free label chosen by the person.", maxLength: 15, hint: L("Up to 15 letters or numbers", "最多 15 個字母或數字") }),
  e("samba.name", "samba", "computer_name", "text", L("Name on the network", "網絡上嘅名稱"), L("How the drive appears when you browse the network from a computer.", "喺電腦瀏覽網絡時，個磁碟顯示嘅名稱。"), { freeText: true, freeTextReason: "A network name is a free label chosen by the person.", maxLength: 15, hint: L("Up to 15 letters or numbers", "最多 15 個字母或數字") }),
  e("accounts", "accounts", "acc_list", "file", L("Sharing accounts", "分享帳戶"), L("The accounts that may open the shares. Managed from the account list, never shown as plain text.", "可以開分享嘅帳戶。由帳戶清單管理，唔會以純文字顯示。"), { secret: true, optional: true, maxLength: 2048, meta: { note: NOTE } }),
  e("ftp.mode", "ftp", "st_ftp_mode", "select", L("Who can sign in over FTP", "邊個可以用 FTP 登入"), L("FTP is not encrypted. Prefer file sharing, and keep anonymous sign-in off.", "FTP 冇加密。盡量用檔案分享，並且唔好容許匿名登入。"), { options: [["1", L("Anyone (anonymous)", "任何人（匿名）")], ["2", L("Only the accounts below", "只限下面嘅帳戶")]], meta: { note: NOTE } }),
  e("ftp.users", "ftp", "st_max_user", "stepper", L("Most people at once (1 to 10)", "最多同時幾多人（1 至 10）"), L("How many people can be signed in over FTP at the same time.", "最多可以幾多人同時用 FTP 登入。"), { min: 1, max: 10 }),
  e("media.name", "media", "dms_friendly_name", "text", L("Media server name", "媒體伺服器名稱"), L("The name TVs and speakers show for this media server.", "電視同喇叭會顯示嘅媒體伺服器名稱。"), { freeText: true, freeTextReason: "The media server name is a free label chosen by the person.", maxLength: 32, hint: L("Up to 32 characters", "最多 32 個字") }),
  e("tm.size", "tm", "tm_vol_size", "slider", L("Time Machine size limit", "Time Machine 容量上限"), L("The most space Mac backups may take on the drive. 0 means no limit.", "Mac 備份最多可以用幾多空間。0 代表冇上限。"), { min: 0, max: 8000, unit: "GB", restart: "restart_timemachine", meta: { note: NOTE } }),
];

// ---- readers ---------------------------------------------------------------

export function parseDf(text) {
  const mounts = [];
  for (const line of String(text).split("\n").slice(1)) {
    const c = line.trim().split(/\s+/);
    if (c.length < 6 || !c[5].startsWith("/tmp/mnt/")) continue;
    const [total, used, free] = [Number(c[1]), Number(c[2]), Number(c[3])];
    if (![total, used, free].every(Number.isFinite)) continue;
    mounts.push({ device: c[0], mount: c.slice(5).join(" "), totalKb: total, usedKb: used, freeKb: free, usedPct: total ? Math.round((used / total) * 100) : 0 });
  }
  return mounts;
}

const accounts = (nvram) => parseRows(nvram.get("acc_list") ?? "").map(([name, password]) => ({ name, password: password ?? "" })).filter((a) => NAME.test(a.name ?? ""));
const list = (value) => (value ? String(value).split(">").filter(Boolean) : []);

export function readShares(nvram) {
  const count = Math.min(Number(nvram.get("sh_num")) || 0, 32);
  return Array.from({ length: count }, (_, i) => ({ index: i, name: nvram.get(`sh_name${i}`) ?? "", path: nvram.get(`sh_path${i}`) ?? "", read: list(nvram.get(`sh_rright${i}`)), write: list(nvram.get(`sh_wright${i}`)) })).filter((s) => s.name);
}
const mediaFolders = (nvram) => parseRows(nvram.get("dms_dir_x") ?? "").map((r) => r[0]).filter(Boolean);

const drives = (nvram) => [1, 2, 3, 4].map((port) => ({ port, kind: nvram.get(`usb_path${port}`) ?? "", manufacturer: nvram.get(`usb_path${port}_manufacturer`) ?? "", product: nvram.get(`usb_path${port}_product`) ?? "" })).filter((d) => d.kind);

// The changes that rewrite the whole share list (and unset what is no longer used).
function shareChanges(nvram, shares) {
  const old = Math.min(Number(nvram.get("sh_num")) || 0, 32);
  const changes = [{ key: "sh_num", value: String(shares.length), risk: "low" }];
  shares.forEach((s, i) => {
    changes.push({ key: `sh_name${i}`, value: s.name, risk: "low" }, { key: `sh_path${i}`, value: s.path, risk: "low" }, { key: `sh_rright${i}`, value: s.read.join(">"), risk: "low" }, { key: `sh_wright${i}`, value: s.write.join(">"), risk: "low" });
  });
  for (let i = shares.length; i < old; i += 1) for (const k of ["sh_name", "sh_path", "sh_rright", "sh_wright"]) changes.push({ key: `${k}${i}`, value: null, risk: "low" });
  return changes;
}

const accountValue = (rows) => formatRows(rows.map((a) => [a.name, a.password]));

export default {
  id: ID,
  catalog,
  domainMeta: [{ id: ID, icon: "usb", label: L("USB apps", "USB 應用"), group: { en: "Router", yue: "路由器" }, requires: "usbX1", live: true }],
  domains: {
    [ID]: async (ctx) => {
      const df = await ctx.exec("df -k");
      return {
        entries: ctx.entries(),
        related: ctx.entries("usb"),
        drives: drives(ctx.nvram),
        mounts: df.code === 0 ? parseDf(df.stdout) : [],
        accounts: accounts(ctx.nvram).map((a) => ({ name: a.name })),
        shares: readShares(ctx.nvram),
        mediaFolders: mediaFolders(ctx.nvram),
      };
    },
  },
  routes(api) {
    const nas = { restart: ["restart_nasapps"] };

    api.get("/folders", async ({ query, live }) => {
      const path = query.path ? safePath(query.path) : "/tmp/mnt";
      const out = await (await live()).exec(`ls -1 -p ${quote(path)}`);
      if (out.code !== 0) throw bad("That folder could not be listed.", 404);
      return { path, folders: out.stdout.split("\n").filter((n) => n.endsWith("/")).map((n) => n.slice(0, -1)).filter((n) => /^[A-Za-z0-9 ._-]{1,64}$/.test(n)).sort() };
    });

    // ---- accounts ----
    const password = (value) => {
      const text = String(value ?? "");
      if (text.length < 8 || text.length > 32 || /[\x00-\x1f<>]/.test(text)) throw bad("Use a password of 8 to 32 characters without < or >.");
      return text;
    };
    api.post("/accounts", async ({ body, live, preview }) => {
      const name = String(body.name ?? "").trim();
      if (!NAME.test(name)) throw bad("Use 1 to 20 letters, numbers, dots, dashes or underscores for the account name.");
      const rows = accounts((await live()).nvram);
      if (rows.some((a) => a.name.toLowerCase() === name.toLowerCase())) throw bad("That account already exists.", 409);
      if (rows.length >= 10) throw bad("The router can keep 10 accounts.");
      return preview({ changes: [{ id: `${ID}.accounts`, value: accountValue([...rows, { name, password: password(body.password) }]) }], ...nas });
    });
    api.patch("/accounts/:name", async ({ params, body, live, preview }) => {
      const rows = accounts((await live()).nvram);
      const row = rows.find((a) => a.name === params.name);
      if (!row) throw bad("That account does not exist.", 404);
      row.password = password(body.password);
      return preview({ changes: [{ id: `${ID}.accounts`, value: accountValue(rows) }], ...nas });
    });
    api.delete("/accounts/:name", async ({ params, live, preview }) => {
      const { nvram } = await live();
      const rows = accounts(nvram);
      if (!rows.some((a) => a.name === params.name)) throw bad("That account does not exist.", 404);
      const shares = readShares(nvram).map((s) => ({ ...s, read: s.read.filter((n) => n !== params.name), write: s.write.filter((n) => n !== params.name) }));
      return preview({ changes: [{ id: `${ID}.accounts`, value: accountValue(rows.filter((a) => a.name !== params.name)) }, ...shareChanges(nvram, shares)], ...nas });
    });

    // ---- shares: add, or change one when body.index is set, and remove ----
    api.post("/shares", async ({ body, live, preview }) => {
      const { nvram } = await live();
      const names = new Set(accounts(nvram).map((a) => a.name));
      const who = (value, label) => {
        const items = [...new Set((Array.isArray(value) ? value : []).map(String))];
        for (const n of items) if (!names.has(n)) throw bad(`${label}: "${n}" is not a sharing account.`);
        return items;
      };
      const name = String(body.name ?? "").trim();
      if (!SHARE.test(name)) throw bad("Use 1 to 32 letters, numbers, spaces, dots, dashes or underscores for the share name.");
      const share = { name, path: safePath(body.path), read: who(body.read, "Can read"), write: who(body.write, "Can change") };
      for (const n of share.write) if (!share.read.includes(n)) share.read.push(n);
      const shares = readShares(nvram);
      const at = body.index === undefined ? -1 : shares.findIndex((s) => s.index === Number(body.index));
      if (body.index !== undefined && at === -1) throw bad("That share no longer exists.", 404);
      if (shares.some((s, i) => i !== at && s.name.toLowerCase() === name.toLowerCase())) throw bad("Another share already has that name.", 409);
      if (at === -1) {
        if (shares.length >= 16) throw bad("The router can keep 16 shares.");
        shares.push(share);
      } else shares[at] = share;
      return preview({ changes: shareChanges(nvram, shares), ...nas });
    });
    api.delete("/shares/:index", async ({ params, live, preview }) => {
      const { nvram } = await live();
      const shares = readShares(nvram);
      const at = shares.findIndex((s) => s.index === Number(params.index));
      if (at === -1) throw bad("That share no longer exists.", 404);
      shares.splice(at, 1);
      return preview({ changes: shareChanges(nvram, shares), ...nas });
    });

    // ---- media folders ----
    const mediaChange = (folders) => ({ changes: [{ key: "dms_dir_x", value: formatRows(folders.map((f) => [f])), risk: "low" }, { key: "dms_dir_type_x", value: formatRows(folders.map(() => ["7"])), risk: "low" }], ...nas });
    api.post("/media-folders", async ({ body, live, preview }) => {
      const folders = mediaFolders((await live()).nvram);
      const path = safePath(body.path);
      if (folders.includes(path)) throw bad("That folder is already shared with the media server.", 409);
      if (folders.length >= 16) throw bad("The media server can use 16 folders.");
      return preview(mediaChange([...folders, path]));
    });
    api.delete("/media-folders/:index", async ({ params, live, preview }) => {
      const folders = mediaFolders((await live()).nvram);
      const at = Number(params.index);
      if (!Number.isInteger(at) || !folders[at]) throw bad("That folder is not in the list.", 404);
      folders.splice(at, 1);
      return preview(mediaChange(folders));
    });
  },
  actions: {
    // Safely removes a drive by asking the router to unmount it first.
    eject: {
      risk: "network",
      confirm: ["hold"],
      run: async ({ body, exec, nvram }) => {
        const port = Number(body.port);
        if (!Number.isInteger(port) || port < 1 || port > 4) throw bad("Choose a USB port from 1 to 4.");
        if (!(await nvram()).get(`usb_path${port}`)) throw bad("There is no drive on that USB port.", 404);
        const out = await exec(`ejusb ${port}`);
        return { ok: out.code === 0, port, message: out.code === 0 ? "You can unplug the drive now." : "The router could not eject the drive. Close any files that are open on it and try again." };
      },
    },
  },
  fakeRouter: {
    nvram: {
      st_samba_mode: "4", st_samba_workgroup: "WORKGROUP", computer_name: "harbour-router", acc_list: "<Pat>harbour-pass1<Alex>harbour-pass2",
      st_ftp_mode: "2", st_max_user: "5", dms_friendly_name: "Harbour media", dms_dir_x: "</tmp/mnt/usb1/Music", dms_dir_type_x: "<7", tm_vol_size: "0",
      sh_num: "1", sh_name0: "Family", sh_path0: "/tmp/mnt/usb1/Family", sh_rright0: "Pat>Alex", sh_wright0: "Pat",
    },
    handlers: [
      (command, router) => {
        if (command === "df -k") {
          const lines = ["Filesystem           1K-blocks      Used Available Use% Mounted on", "/dev/root                29184     29184         0 100% /"];
          if (router.nvram.usb_path1) lines.push("/dev/sda1            244190644  95814420 148376224  39% /tmp/mnt/usb1");
          return { stdout: `${lines.join("\n")}\n` };
        }
        const ls = command.match(/^ls -1 -p '(\/tmp\/mnt[^']*)'$/);
        if (ls) return ls[1] === "/tmp/mnt" ? { stdout: "usb1/\n" } : ls[1] === "/tmp/mnt/usb1" ? { stdout: "Family/\nMusic/\nVideos/\nnotes.txt\n" } : { code: 1, stdout: "" };
        if (command === "ejusb 1") {
          router.nvram.usb_path1 = "";
          return { stdout: "" };
        }
        if (/^ejusb \d$/.test(command)) return { code: 1, stdout: "" };
        return undefined;
      },
    ],
  },
};
