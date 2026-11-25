// Reads the router's temperatures and fan. Read only: nothing here changes the
// router. A value the router does not report is null, never a made-up number.

export const FAN_COMMAND = "head -n 100000 /sys/class/hwmon/hwmon0/fan1_input";
export const DMU_COMMAND = "head -n 100000 /proc/dmu/temperature";
export const CPU_COMMAND = "head -n 100000 /sys/class/thermal/thermal_zone0/temp";

// The first number in a line such as "61000" or "CPU temperature: 61. (Celsius)".
export const firstNumber = (text) => {
  const m = String(text).match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

const sane = (value, low, high) => (value !== null && Number.isFinite(value) && value >= low && value <= high ? value : null);

// Wireless names the router uses for each radio, in the order of info.bands.
const RADIO_NAMES = { 2: { en: "2.4 GHz radio", yue: "2.4 GHz 無線電" }, 1: { en: "5 GHz radio", yue: "5 GHz 無線電" }, 4: { en: "6 GHz radio", yue: "6 GHz 無線電" } };

export async function readSensors({ exec, info, nvram }) {
  const run = async (command) => {
    const out = await exec(command);
    return out.code === 0 ? out.stdout : "";
  };
  const gauges = [];
  // Processor: the standard thermal zone reports thousandths of a degree; the Broadcom file reports whole degrees.
  let cpu = firstNumber(await run(CPU_COMMAND));
  cpu = cpu === null ? null : sane(cpu / 1000, -20, 150);
  if (cpu === null) cpu = sane(firstNumber(await run(DMU_COMMAND)), -20, 150);
  gauges.push({ id: "cpu", kind: "temperature", label: { en: "Processor", yue: "處理器" }, value: cpu, unit: "C", warnAt: 80, maxAt: 100 });
  for (const band of info.bands) {
    const raw = firstNumber(await run(`wl -i ${band.ifname} phy_tempsense`));
    gauges.push({ id: `radio${band.index}`, kind: "temperature", label: RADIO_NAMES[band.nband] ?? { en: `Radio ${band.index + 1}`, yue: `無線電 ${band.index + 1}` }, value: sane(raw, -20, 150), unit: "C", warnAt: 85, maxAt: 105 });
  }
  const fan = sane(firstNumber(await run(FAN_COMMAND)), 0, 20000);
  gauges.push({ id: "fan", kind: "fan", label: { en: "Fan", yue: "風扇" }, value: fan, unit: "rpm", warnAt: 5200, maxAt: 6500, mode: nvram.get("fan_mode") ?? null });
  return { gauges, readAt: new Date().toISOString() };
}
