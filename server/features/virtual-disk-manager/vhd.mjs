// The Windows virtual disk manager's engine. It builds PowerShell scripts for
// the Hyper-V and storage cmdlets from validated pieces, and runs them only
// when the server is on Windows and the desktop app has switched the feature
// on. Elevation is never requested here: when Windows needs it, the person
// runs the desktop app as an administrator and approves the prompt themselves.
const { execFile } = process.getBuiltinModule("child_process");

const KB = 1024;
export const GB = KB ** 3;
export const TB = KB ** 4;
// VHD is limited to 2040 GB; VHDX and VHD Set to 64 TB.
export const LIMITS = { vhd: 2040 * GB, vhdx: 64 * TB, vhds: 64 * TB };
export const UNITS = { MB: KB ** 2, GB, TB };

const bad = (message, status = 400) => Object.assign(new Error(message), { status });

// A full Windows path to a file with an allowed extension. Characters that
// could end a quoted PowerShell string or start another command are refused.
export function diskPath(value, extensions = ["vhd", "vhdx", "vhds"]) {
  const text = String(value ?? "").trim();
  if (!/^[A-Za-z]:\\/.test(text) && !/^\\\\[^\\]+\\[^\\]+\\/.test(text)) throw bad("Write the full path, for example D:\\Disks\\data.vhdx.");
  if (/['"`$;|&<>\r\n\0*?]/.test(text) || text.includes("..")) throw bad("The path contains a character that is not allowed: ' \" ` $ ; | & < > * ? or ..");
  if (text.length > 240) throw bad("The path is longer than 240 characters.");
  const ext = text.split(".").pop().toLowerCase();
  if (!extensions.includes(ext)) throw bad(`The file must end in .${extensions.join(", .")}.`);
  return text;
}

export const formatOf = (path) => path.split(".").pop().toLowerCase();

export function sizeBytes(value, unit = "GB", format = "vhdx") {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw bad("The size must be a number above zero.");
  const factor = UNITS[unit];
  if (!factor) throw bad("The size unit must be MB, GB or TB.");
  const bytes = Math.round(n * factor);
  if (bytes < 3 * KB ** 2) throw bad("The smallest size is 3 MB.");
  if (bytes > LIMITS[format]) throw bad(`A .${format} file can be at most ${format === "vhd" ? "2040 GB" : "64 TB"}.`);
  if (bytes % 512) throw bad("The size must be a multiple of 512 bytes.");
  return bytes;
}

const q = (s) => `'${s}'`;
const notThere = (p) => `if (Test-Path -LiteralPath ${q(p)}) { throw 'A file already exists at that path. Nothing was changed.' }`;
const there = (p) => `if (-not (Test-Path -LiteralPath ${q(p)})) { throw 'That file does not exist.' }`;
const HEAD = "$ErrorActionPreference = 'Stop'";
const JSON_OUT = "| ConvertTo-Json -Compress";

// Every operation: which cmdlets it uses (the "route"), and its script.
export const OPERATIONS = {
  list: { route: "Get-Disk (storage)", write: false },
  info: { route: "Get-VHD (Hyper-V module)", write: false },
  create: { route: "New-VHD (Hyper-V module)", write: true },
  "create-differencing": { route: "New-VHD -Differencing (Hyper-V module)", write: true },
  attach: { route: "Mount-VHD (Hyper-V module)", write: true },
  detach: { route: "Dismount-VHD (Hyper-V module)", write: true },
  grow: { route: "Resize-VHD (Hyper-V module)", write: true },
  shrink: { route: "Resize-VHD (Hyper-V module)", write: true },
  compact: { route: "Optimize-VHD (Hyper-V module)", write: true },
  convert: { route: "Convert-VHD (Hyper-V module)", write: true },
  "attach-iso": { route: "Mount-DiskImage (storage)", write: true },
  "detach-iso": { route: "Dismount-DiskImage (storage)", write: true },
};

export function buildScript(op, input = {}) {
  if (!OPERATIONS[op]) throw bad(`There is no operation called ${op}.`, 404);
  switch (op) {
    case "list":
      return `${HEAD}\nGet-Disk | Where-Object { $_.BusType -eq 'File Backed Virtual' } | Select-Object Number, FriendlyName, Size, OperationalStatus, PartitionStyle ${JSON_OUT}`;
    case "info": {
      const path = diskPath(input.path);
      return `${HEAD}\n${there(path)}\nGet-VHD -Path ${q(path)} | Select-Object Path, VhdFormat, VhdType, FileSize, Size, MinimumSize, ParentPath, Attached, BlockSize ${JSON_OUT}`;
    }
    case "create": {
      const path = diskPath(input.path);
      const format = formatOf(path);
      const size = sizeBytes(input.size, input.unit, format);
      const kind = input.type === "fixed" ? "-Fixed" : "-Dynamic";
      if (format === "vhds" && kind === "-Fixed") throw bad("A VHD Set is always dynamic.");
      return `${HEAD}\n${notThere(path)}\nNew-VHD -Path ${q(path)} -SizeBytes ${size} ${kind} | Select-Object Path, VhdFormat, VhdType, Size ${JSON_OUT}`;
    }
    case "create-differencing": {
      const path = diskPath(input.path, ["vhd", "vhdx"]);
      const parent = diskPath(input.parent, ["vhd", "vhdx"]);
      if (formatOf(path) !== formatOf(parent)) throw bad("A differencing disk must be the same format as its parent.");
      if (path.toLowerCase() === parent.toLowerCase()) throw bad("A disk cannot be its own parent.");
      return `${HEAD}\n${notThere(path)}\n${there(parent)}\nNew-VHD -Path ${q(path)} -ParentPath ${q(parent)} -Differencing | Select-Object Path, VhdFormat, VhdType, ParentPath ${JSON_OUT}`;
    }
    case "attach": {
      const path = diskPath(input.path);
      return `${HEAD}\n${there(path)}\nMount-VHD -Path ${q(path)}${input.readOnly ? " -ReadOnly" : ""} -Passthru | Select-Object Path, Attached ${JSON_OUT}`;
    }
    case "detach": {
      const path = diskPath(input.path);
      return `${HEAD}\n${there(path)}\nDismount-VHD -Path ${q(path)}\n@{ Path = ${q(path)}; Attached = $false } ${JSON_OUT}`;
    }
    case "grow": {
      const path = diskPath(input.path, ["vhd", "vhdx"]);
      const size = sizeBytes(input.size, input.unit, formatOf(path));
      return `${HEAD}\n${there(path)}\n$current = (Get-VHD -Path ${q(path)}).Size\nif (${size} -le $current) { throw 'The new size must be larger than the current size. Use shrink to make a disk smaller.' }\nResize-VHD -Path ${q(path)} -SizeBytes ${size}\nGet-VHD -Path ${q(path)} | Select-Object Path, Size, FileSize ${JSON_OUT}`;
    }
    case "shrink": {
      const path = diskPath(input.path, ["vhdx"]);
      if (input.toMinimum) return `${HEAD}\n${there(path)}\nResize-VHD -Path ${q(path)} -ToMinimumSize\nGet-VHD -Path ${q(path)} | Select-Object Path, Size, FileSize ${JSON_OUT}`;
      const size = sizeBytes(input.size, input.unit, "vhdx");
      return `${HEAD}\n${there(path)}\n$current = (Get-VHD -Path ${q(path)}).Size\nif (${size} -ge $current) { throw 'The new size must be smaller than the current size.' }\nResize-VHD -Path ${q(path)} -SizeBytes ${size}\nGet-VHD -Path ${q(path)} | Select-Object Path, Size, FileSize ${JSON_OUT}`;
    }
    case "compact": {
      const path = diskPath(input.path, ["vhd", "vhdx"]);
      return `${HEAD}\n${there(path)}\nOptimize-VHD -Path ${q(path)} -Mode Full\nGet-VHD -Path ${q(path)} | Select-Object Path, FileSize, Size ${JSON_OUT}`;
    }
    case "convert": {
      const from = diskPath(input.path, ["vhd", "vhdx"]);
      const to = diskPath(input.destination, ["vhd", "vhdx"]);
      if (formatOf(from) === formatOf(to)) throw bad("Pick a destination with a different extension (.vhd to .vhdx or the other way).");
      if (formatOf(to) === "vhd" && Number(input.sourceSizeGb) > 2040) throw bad("A disk larger than 2040 GB cannot become a .vhd.");
      const kind = input.type === "fixed" ? "Fixed" : "Dynamic";
      return `${HEAD}\n${there(from)}\n${notThere(to)}\nConvert-VHD -Path ${q(from)} -DestinationPath ${q(to)} -VHDType ${kind}\nGet-VHD -Path ${q(to)} | Select-Object Path, VhdFormat, VhdType, Size ${JSON_OUT}`;
    }
    case "attach-iso": {
      const path = diskPath(input.path, ["iso"]);
      return `${HEAD}\n${there(path)}\nMount-DiskImage -ImagePath ${q(path)} -Access ReadOnly | Select-Object ImagePath, Attached ${JSON_OUT}`;
    }
    case "detach-iso": {
      const path = diskPath(input.path, ["iso"]);
      return `${HEAD}\n${there(path)}\nDismount-DiskImage -ImagePath ${q(path)}\n@{ ImagePath = ${q(path)}; Attached = $false } ${JSON_OUT}`;
    }
    default:
      throw bad("Unknown operation.");
  }
}

// PowerShell takes a script most safely as UTF-16 base64, so no quoting
// problem can change what it runs.
export const encodeCommand = (script) => Buffer.from(script, "utf16le").toString("base64");

export function powershellRunner(script) {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodeCommand(script)], { timeout: 120000, windowsHide: true, maxBuffer: 4 << 20 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === "number" ? error.code : 1) : 0, stdout: String(stdout), stderr: String(stderr || error?.message || "") });
    });
  });
}

const NEEDS_ADMIN = /administrator|elevat|access (is )?denied|privilege|requested operation requires/i;
const NEEDS_HYPERV = /not recognized as the name of a cmdlet|Hyper-V module|is not recognized/i;

export function makeManager({ platform = process.platform, desktop = process.env.MAR_DESKTOP_SHELL === "1", run = powershellRunner } = {}) {
  const available = platform === "win32" && desktop;
  const reason = platform !== "win32"
    ? { en: `The virtual disk manager needs the Windows desktop app. This server runs on ${platform}, so it cannot manage Windows virtual disks.`, yue: `虛擬磁碟管理員需要 Windows 桌面版程式。呢部伺服器行緊 ${platform}，管理唔到 Windows 虛擬磁碟。` }
    : !desktop ? { en: "The web app does not manage disks on the computer it runs on. Open the Windows desktop app to use the virtual disk manager.", yue: "網頁版唔會管理佢所在電腦嘅磁碟。請開啟 Windows 桌面版程式使用虛擬磁碟管理員。" } : null;
  return {
    available,
    reason,
    async run(op, input = {}) {
      if (!available) throw bad(reason.en, 409);
      const script = buildScript(op, input);
      const result = await run(script);
      const message = (result.stderr || result.stdout).trim();
      if (result.code !== 0) {
        const hint = NEEDS_ADMIN.test(message) ? "Windows needs administrator rights for this. Close the app, start it as an administrator and approve the Windows prompt yourself; the app never approves it for you." : NEEDS_HYPERV.test(message) ? "The Hyper-V PowerShell module is not available. Turn on the Hyper-V management tools in Windows features, then try again." : null;
        throw Object.assign(bad(`${message.split("\n")[0] || "PowerShell reported an error."}${hint ? ` ${hint}` : ""}`, 422), { route: OPERATIONS[op].route, script, hint });
      }
      let output = null;
      try {
        output = result.stdout.trim() ? JSON.parse(result.stdout) : null;
      } catch {
        output = result.stdout.trim();
      }
      return { ok: true, operation: op, route: OPERATIONS[op].route, equivalent: script, output };
    },
  };
}

let manager = makeManager();
export const current = () => manager;
export const setManager = (next) => {
  manager = next;
};
