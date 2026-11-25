// Network services: the small helper services of the router (NFS, printer
// server, SNMP, Bonjour and Windows discovery), the USB disk idle timer, and a
// disk health page (SMART read-out and a read-only file system check).
//
// Every setting is a typed control that reads its real nvram value. A setting
// whose name this router does not have is shown locked with the reason, and
// is never written. The health and check routes only read: nothing here runs
// a command that changes a disk.
import { L, ON_OFF, quote } from "../kit.mjs";
import { missingSettings, parseExports, parseMounts, parsePartitions, parseSmart } from "./disks.mjs";

const ID = "network-services";
const G = {
  nfs: L("NFS file sharing", "NFS 檔案分享"),
  print: L("Printer server", "打印伺服器"),
  usb: L("USB drives", "USB 磁碟"),
  discovery: L("Discovery and monitoring", "探索同監察"),
};
const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${ID}.${id}`, domain: ID, group, groupLabel: G[group], key, control, label, help, risk: "low", ...extra });

export const catalog = () => [
  e("nfs.enable", "nfs", "nfsd_enable", "switch", L("NFS server", "NFS 伺服器"), L("Lets Linux and Mac computers at home open the USB drive over NFS. NFS has no sign-in, so only turn it on at home and only for the folders below.", "等屋企嘅 Linux 同 Mac 用 NFS 開 USB 磁碟。NFS 冇登入，所以淨係喺屋企開，而且只分享下面嗰啲資料夾。"),
    { values: ON_OFF, firmware: "merlin", restart: "restart_nfs", risk: "network" }),
  e("nfs.exports", "nfs", "nfsd_exportlist", "file", L("Shared folders (NFS exports)", "NFS 分享嘅資料夾"), L("The folders the router offers over NFS, as the router keeps them. Shown only; change them in the router's own NFS page.", "路由器用 NFS 提供嘅資料夾，同路由器入面一樣。只顯示；請喺路由器自己嘅 NFS 頁面改。"),
    { readOnly: true, optional: true, maxLength: 1024, firmware: "merlin" }),
  e("print.lprd", "print", "lprd_enable", "switch", L("Printer server (LPR)", "打印伺服器（LPR）"), L("Shares a USB printer with the computers at home. Only older models have this; newer ones leave printing to the printer itself.", "將 USB 打印機分享畀屋企電腦。只有較舊嘅型號先有；新型號就由打印機自己處理。"),
    { values: ON_OFF, restart: "restart_nasapps" }),
  e("usb.idle", "usb", "usb_idle_timeout", "select", L("Let the USB drive sleep after", "USB 磁碟閒置幾耐後休眠"), L("A drive that sleeps lasts longer and is quieter, and wakes with a short delay when somebody opens it. Never means it spins all the time.", "休眠嘅磁碟壽命較長、較靜，有人開嘅時候會慢少少先醒。永不代表一直轉。"),
    { requires: "usbX1", restart: "restart_nasapps", options: [["0", L("Never", "永不")], ["600", L("10 minutes", "10 分鐘")], ["1800", L("30 minutes", "30 分鐘")], ["3600", L("1 hour", "1 小時")], ["7200", L("2 hours", "2 小時")]] }),
  e("snmp.enable", "discovery", "snmpd_enable", "switch", L("SNMP monitoring", "SNMP 監察"), L("Lets a monitoring tool at home read the router's counters. Turn it on only if you use such a tool.", "等屋企嘅監察工具讀取路由器嘅計數。有用呢類工具先開。"),
    { values: ON_OFF, firmware: "merlin", restart: "restart_snmpd" }),
  e("mdns.enable", "discovery", "mdns_enable", "switch", L("Bonjour (mDNS) names", "Bonjour（mDNS）名稱"), L("Lets Apple devices and printers find shared drives by name. Leave on if you use AirPrint or Time Machine.", "等 Apple 裝置同打印機用名稱搵到分享磁碟。用 AirPrint 或 Time Machine 就要開。"),
    { values: ON_OFF, restart: "restart_mdns" }),
  e("wsdd.enable", "discovery", "wsdd_enable", "switch", L("Windows network discovery", "Windows 網絡探索"), L("Makes the shared drive appear under Network in Windows Explorer.", "等分享磁碟喺 Windows 檔案總管嘅「網絡」入面出現。"),
    { values: ON_OFF, restart: "restart_nasapps" }),
];

const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const DISK = /^sd[a-z]$/;
const PART = /^sd[a-z][0-9]{1,2}$/;

async function disks(exec) {
  const [partitions, mounts] = await Promise.all([exec("head -n 100000 /proc/partitions"), exec("head -n 100000 /proc/mounts")]);
  const parts = parsePartitions(partitions.code === 0 ? partitions.stdout : "");
  const mounted = parseMounts(mounts.code === 0 ? mounts.stdout : "");
  return parts.map((d) => ({ ...d, partitions: d.partitions.map((p) => ({ ...p, mountedAt: mounted.get(p.name) ?? "" })) }));
}

export default {
  id: ID,
  catalog,
  domainMeta: [{ id: ID, icon: "settings_ethernet", label: L("Network services", "網絡服務"), group: { en: "Router", yue: "路由器" }, live: true }],
  domains: {
    [ID]: async (ctx) => {
      const list = await disks(ctx.exec);
      const get = (key) => ctx.nvram.get(key) ?? "";
      return {
        entries: missingSettings(ctx.entries(), ctx.nvram),
        disks: list,
        exports: parseExports(get("nfsd_exportlist")),
        // Other screens own these settings; they are only shown here, with where to change them.
        related: {
          timeMachine: { enabled: get("timemachine_enable") === "1", limitGb: Number(get("tm_vol_size")) || 0, screen: "usb-apps" },
          usbMode: { value: get("usb_usb3"), screen: "system-pro" },
        },
        merlin: ctx.info.merlin,
      };
    },
  },
  routes(api) {
    // SMART health of one drive. It only reads.
    api.get("/health/:disk", async ({ params, live }) => {
      if (!DISK.test(params.disk)) throw bad("Choose a drive such as sda.");
      const router = await live();
      if (!(await disks(router.exec)).some((d) => d.name === params.disk)) throw bad("That drive is not connected.", 404);
      const out = await router.exec(`smartctl -a ${quote(`/dev/${params.disk}`)}`, { timeoutMs: 30000 });
      if (out.code === 127) return { disk: params.disk, available: false, reason: "smartctl is not installed on this router. On Asuswrt-Merlin, install smartmontools with Entware." };
      return { disk: params.disk, available: true, ...parseSmart(out.stdout) };
    });
    // A file system check that never repairs (fsck -n). Only a drive that is not mounted can be checked.
    api.post("/check", async ({ body, live }) => {
      const partition = String(body.partition ?? "");
      if (!PART.test(partition)) throw bad("Choose a partition such as sda1.");
      const router = await live();
      const found = (await disks(router.exec)).flatMap((d) => d.partitions).find((p) => p.name === partition);
      if (!found) throw bad("That partition is not connected.", 404);
      if (found.mountedAt) throw bad("That drive is in use. Eject it from USB apps first, because checking a mounted drive can give wrong answers.", 409);
      const out = await router.exec(`fsck -n ${quote(`/dev/${partition}`)}`, { timeoutMs: 120000 });
      if (out.code === 127) return { partition, available: false, reason: "This router has no file system check tool." };
      return { partition, available: true, clean: out.code === 0, code: out.code, summary: String(out.stdout ?? "").split("\n").filter(Boolean).slice(-6).map((s) => s.slice(0, 200)), repaired: false };
    });
  },
  fakeRouter: {
    nvram: { nfsd_enable: "0", nfsd_exportlist: "</tmp/mnt/usb1/Family>198.51.100.0/24>rw,sync", lprd_enable: "0", usb_idle_timeout: "0", snmpd_enable: "0", mdns_enable: "1", wsdd_enable: "1" },
    handlers: [
      (command, router) => {
        if (command === "head -n 100000 /proc/partitions")
          return { stdout: "major minor  #blocks  name\n\n   8        0  244198584 sda\n   8        1  244190646 sda1\n   8       16  122104320 sdb\n   8       17  122100000 sdb1\n  31        0       2048 mtdblock0\n" };
        if (command === "head -n 100000 /proc/mounts")
          return { stdout: `rootfs / rootfs rw 0 0\n${router.nvram.usb_path1 ? "/dev/sda1 /tmp/mnt/usb1 ext4 rw,noatime 0 0\n" : ""}` };
        if (command === "smartctl -a '/dev/sda'")
          return { stdout: "smartctl 7.3 2022-02-28\n=== START OF READ SMART DATA SECTION ===\nSMART overall-health self-assessment test result: PASSED\nID# ATTRIBUTE_NAME          FLAG     VALUE WORST THRESH TYPE      UPDATED  WHEN_FAILED RAW_VALUE\n  5 Reallocated_Sector_Ct   0x0033   100   100   010    Pre-fail  Always       -       0\n  9 Power_On_Hours          0x0032   097   097   000    Old_age   Always       -       2904\n194 Temperature_Celsius     0x0022   064   050   000    Old_age   Always       -       36 (Min/Max 20/50)\n197 Current_Pending_Sector  0x0032   100   100   000    Old_age   Always       -       0\n" };
        if (command === "smartctl -a '/dev/sdb'") return { stdout: "smartctl 7.3\nSMART overall-health self-assessment test result: FAILED!\n  5 Reallocated_Sector_Ct   0x0033   090   090   010    Pre-fail  Always       -       48\n197 Current_Pending_Sector  0x0032   100   100   000    Old_age   Always       -       3\n" };
        if (command === "fsck -n '/dev/sdb1'") return { stdout: "fsck from util-linux 2.38\n/dev/sdb1: clean, 11/7634944 files, 530190/30525000 blocks\n" };
        return undefined;
      },
    ],
  },
};
