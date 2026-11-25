// Pure readers for the network-services feature: drives, mounts, SMART output
// and the NFS export list. Nothing here talks to the router.

// A setting this router does not have is shown locked, with the reason, and is
// never written. (The entry's own firmware or capability lock wins.)
export function missingSettings(entries, nvram) {
  return entries.map((entry) => {
    if (entry.disabled || nvram.has(entry.key)) return entry;
    return { ...entry, disabled: { en: `This router does not have the setting ${entry.key}`, yue: `呢部路由器冇 ${entry.key} 呢個設定` } };
  });
}

// /proc/partitions: whole drives (sda) with their partitions (sda1), sizes in kilobytes.
export function parsePartitions(text) {
  const disks = new Map();
  for (const line of String(text).split("\n")) {
    const m = line.trim().match(/^\d+\s+\d+\s+(\d+)\s+(sd[a-z])([0-9]{0,2})$/);
    if (!m) continue;
    const [, blocks, disk, number] = m;
    const row = disks.get(disk) ?? { name: disk, sizeKb: 0, partitions: [] };
    if (number) row.partitions.push({ name: `${disk}${number}`, sizeKb: Number(blocks) });
    else row.sizeKb = Number(blocks);
    disks.set(disk, row);
  }
  return [...disks.values()];
}

// /proc/mounts: partition name -> where it is mounted.
export function parseMounts(text) {
  const out = new Map();
  for (const line of String(text).split("\n")) {
    const m = line.match(/^\/dev\/(sd[a-z][0-9]{1,2})\s+(\S+)\s/);
    if (m) out.set(m[1], m[2]);
  }
  return out;
}

// The few SMART facts a person can use. Anything the drive does not report stays null.
export function parseSmart(text) {
  const out = { health: "unknown", temperatureC: null, powerOnHours: null, reallocated: null, pending: null, warnings: [] };
  const verdict = String(text).match(/overall-health self-assessment test result:\s*(\w+)/i);
  if (verdict) out.health = /^passed$/i.test(verdict[1]) ? "passed" : "failed";
  for (const line of String(text).split("\n")) {
    const cols = line.trim().split(/\s+/);
    if (!/^\d+$/.test(cols[0] ?? "")) continue;
    const raw = Number(cols[9]);
    if (!Number.isFinite(raw)) continue;
    if (cols[1] === "Reallocated_Sector_Ct") out.reallocated = raw;
    else if (cols[1] === "Current_Pending_Sector") out.pending = raw;
    else if (cols[1] === "Power_On_Hours") out.powerOnHours = raw;
    else if (cols[1] === "Temperature_Celsius") out.temperatureC = raw;
  }
  if (out.health === "failed") out.warnings.push("The drive reports that it is failing. Copy anything important off it now.");
  if (out.reallocated > 0) out.warnings.push(`${out.reallocated} sectors have been moved because they went bad.`);
  if (out.pending > 0) out.warnings.push(`${out.pending} sectors are waiting to be moved because they could not be read.`);
  if (out.temperatureC !== null && out.temperatureC >= 55) out.warnings.push("The drive is hot. Give it some air.");
  return out;
}

// nfsd_exportlist is rows of "<folder>client>options". Anything that does not fit is kept as a plain folder row.
export function parseExports(value) {
  return String(value ?? "")
    .split("<")
    .filter(Boolean)
    .slice(0, 32)
    .map((row) => {
      const [folder = "", client = "", options = ""] = row.split(">");
      return { folder: folder.slice(0, 200), client: client.slice(0, 80), options: options.slice(0, 80) };
    });
}
