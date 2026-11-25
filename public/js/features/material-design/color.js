// Colour maths for the picker and the translator. Pure functions, no DOM.
// A colour is { r, g, b, a } in sRGB with each channel nominally 0..1. Values
// from Lab, LCH, OKLab and OKLCH may land outside that range; they are kept as
// they are so nothing is silently dropped, and `inGamut` / `gamutMap` say so.

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const round = (v, d = 0) => Number(v.toFixed(d));
const hueOf = (h) => ((h % 360) + 360) % 360;

// The CSS named colours, "name hex" pairs.
const NAMES = "aliceblue f0f8ff,antiquewhite faebd7,aqua 00ffff,aquamarine 7fffd4,azure f0ffff,beige f5f5dc,bisque ffe4c4,black 000000,blanchedalmond ffebcd,blue 0000ff,blueviolet 8a2be2,brown a52a2a,burlywood deb887,cadetblue 5f9ea0,chartreuse 7fff00,chocolate d2691e,coral ff7f50,cornflowerblue 6495ed,cornsilk fff8dc,crimson dc143c,cyan 00ffff,darkblue 00008b,darkcyan 008b8b,darkgoldenrod b8860b,darkgray a9a9a9,darkgreen 006400,darkgrey a9a9a9,darkkhaki bdb76b,darkmagenta 8b008b,darkolivegreen 556b2f,darkorange ff8c00,darkorchid 9932cc,darkred 8b0000,darksalmon e9967a,darkseagreen 8fbc8f,darkslateblue 483d8b,darkslategray 2f4f4f,darkslategrey 2f4f4f,darkturquoise 00ced1,darkviolet 9400d3,deeppink ff1493,deepskyblue 00bfff,dimgray 696969,dimgrey 696969,dodgerblue 1e90ff,firebrick b22222,floralwhite fffaf0,forestgreen 228b22,fuchsia ff00ff,gainsboro dcdcdc,ghostwhite f8f8ff,gold ffd700,goldenrod daa520,gray 808080,green 008000,greenyellow adff2f,grey 808080,honeydew f0fff0,hotpink ff69b4,indianred cd5c5c,indigo 4b0082,ivory fffff0,khaki f0e68c,lavender e6e6fa,lavenderblush fff0f5,lawngreen 7cfc00,lemonchiffon fffacd,lightblue add8e6,lightcoral f08080,lightcyan e0ffff,lightgoldenrodyellow fafad2,lightgray d3d3d3,lightgreen 90ee90,lightgrey d3d3d3,lightpink ffb6c1,lightsalmon ffa07a,lightseagreen 20b2aa,lightskyblue 87cefa,lightslategray 778899,lightslategrey 778899,lightsteelblue b0c4de,lightyellow ffffe0,lime 00ff00,limegreen 32cd32,linen faf0e6,magenta ff00ff,maroon 800000,mediumaquamarine 66cdaa,mediumblue 0000cd,mediumorchid ba55d3,mediumpurple 9370db,mediumseagreen 3cb371,mediumslateblue 7b68ee,mediumspringgreen 00fa9a,mediumturquoise 48d1cc,mediumvioletred c71585,midnightblue 191970,mintcream f5fffa,mistyrose ffe4e1,moccasin ffe4b5,navajowhite ffdead,navy 000080,oldlace fdf5e6,olive 808000,olivedrab 6b8e23,orange ffa500,orangered ff4500,orchid da70d6,palegoldenrod eee8aa,palegreen 98fb98,paleturquoise afeeee,palevioletred db7093,papayawhip ffefd5,peachpuff ffdab9,peru cd853f,pink ffc0cb,plum dda0dd,powderblue b0e0e6,purple 800080,rebeccapurple 663399,red ff0000,rosybrown bc8f8f,royalblue 4169e1,saddlebrown 8b4513,salmon fa8072,sandybrown f4a460,seagreen 2e8b57,seashell fff5ee,sienna a0522d,silver c0c0c0,skyblue 87ceeb,slateblue 6a5acd,slategray 708090,slategrey 708090,snow fffafa,springgreen 00ff7f,steelblue 4682b4,tan d2b48c,teal 008080,thistle d8bfd8,tomato ff6347,turquoise 40e0d0,violet ee82ee,wheat f5deb3,white ffffff,whitesmoke f5f5f5,yellow ffff00,yellowgreen 9acd32";
export const NAMED = Object.fromEntries(NAMES.split(",").map((p) => p.split(" ")));

const fromHex6 = (h) => ({ r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: 1 });

// ---- transfer functions and matrices ---------------------------------------
const toLin = (c) => (Math.abs(c) <= 0.04045 ? c / 12.92 : Math.sign(c) * ((Math.abs(c) + 0.055) / 1.055) ** 2.4);
const fromLin = (c) => (Math.abs(c) <= 0.0031308 ? c * 12.92 : Math.sign(c) * (1.055 * Math.abs(c) ** (1 / 2.4) - 0.055));
const mul = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const RGB_XYZ50 = [0.4360747, 0.3850649, 0.1430804, 0.2225045, 0.7168786, 0.0606169, 0.0139322, 0.0971045, 0.7141733];
const XYZ50_RGB = [3.1338561, -1.6168667, -0.4906146, -0.9787684, 1.9161415, 0.033454, 0.0719453, -0.2289914, 1.4052427];
const D50 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
const EPS = 216 / 24389;
const KAPPA = 24389 / 27;

export function toOklab({ r, g, b }) {
  const [lr, lg, lb] = [toLin(r), toLin(g), toLin(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s };
}
export function fromOklab({ L, a, b }, alpha = 1) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return { r: fromLin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), g: fromLin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), b: fromLin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s), a: alpha };
}
export const toOklch = (c) => {
  const { L, a, b } = toOklab(c);
  const C = Math.hypot(a, b);
  return { L, C, h: C < 1e-6 ? 0 : hueOf((Math.atan2(b, a) * 180) / Math.PI) };
};
export const fromOklch = ({ L, C, h }, alpha = 1) => fromOklab({ L, a: C * Math.cos((h * Math.PI) / 180), b: C * Math.sin((h * Math.PI) / 180) }, alpha);

export function toLab({ r, g, b }) {
  const xyz = mul(RGB_XYZ50, [toLin(r), toLin(g), toLin(b)]);
  const f = xyz.map((v, i) => { const t = v / D50[i]; return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116; });
  return { L: 116 * f[1] - 16, a: 500 * (f[0] - f[1]), b: 200 * (f[1] - f[2]) };
}
export function fromLab({ L, a, b }, alpha = 1) {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = (fx ** 3 > EPS ? fx ** 3 : (116 * fx - 16) / KAPPA) * D50[0];
  const y = L > KAPPA * EPS ? fy ** 3 : L / KAPPA;
  const z = (fz ** 3 > EPS ? fz ** 3 : (116 * fz - 16) / KAPPA) * D50[2];
  const [lr, lg, lb] = mul(XYZ50_RGB, [x, y, z]);
  return { r: fromLin(lr), g: fromLin(lg), b: fromLin(lb), a: alpha };
}
export const toLch = (c) => {
  const { L, a, b } = toLab(c);
  const C = Math.hypot(a, b);
  return { L, C, h: C < 1e-4 ? 0 : hueOf((Math.atan2(b, a) * 180) / Math.PI) };
};
export const fromLch = ({ L, C, h }, alpha = 1) => fromLab({ L, a: C * Math.cos((h * Math.PI) / 180), b: C * Math.sin((h * Math.PI) / 180) }, alpha);

export function toHsl({ r, g, b }) {
  const [R, G, B] = [clamp(r), clamp(g), clamp(b)];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: hueOf(h * 60), s, l };
}
export function fromHsl({ h, s, l }, a = 1) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = hueOf(h) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return { r: r1 + m, g: g1 + m, b: b1 + m, a };
}
export function toHsv(c) {
  const { h } = toHsl(c);
  const [R, G, B] = [clamp(c.r), clamp(c.g), clamp(c.b)];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  return { h, s: max === 0 ? 0 : (max - min) / max, v: max };
}
export function fromHsv({ h, s, v }, a = 1) {
  const l = v * (1 - s / 2);
  return fromHsl({ h, s: l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l), l }, a);
}
export function toHwb(c) {
  const { h } = toHsl(c);
  const [R, G, B] = [clamp(c.r), clamp(c.g), clamp(c.b)];
  return { h, w: Math.min(R, G, B), bl: 1 - Math.max(R, G, B) };
}
export function fromHwb({ h, w, bl }, a = 1) {
  if (w + bl >= 1) { const g = w / (w + bl); return { r: g, g, b: g, a }; }
  const c = fromHsl({ h, s: 1, l: 0.5 }, a);
  const k = 1 - w - bl;
  return { r: c.r * k + w, g: c.g * k + w, b: c.b * k + w, a };
}
export function toCmyk(c) {
  const [R, G, B] = [clamp(c.r), clamp(c.g), clamp(c.b)];
  const k = 1 - Math.max(R, G, B);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 1 };
  return { c: (1 - R - k) / (1 - k), m: (1 - G - k) / (1 - k), y: (1 - B - k) / (1 - k), k };
}
export const fromCmyk = ({ c, m, y, k }, a = 1) => ({ r: (1 - c) * (1 - k), g: (1 - m) * (1 - k), b: (1 - y) * (1 - k), a });

// ---- gamut, contrast, names -------------------------------------------------
export const inGamut = (c, eps = 0.0005) => [c.r, c.g, c.b].every((v) => v >= -eps && v <= 1 + eps);
export const clampColor = (c) => ({ r: clamp(c.r), g: clamp(c.g), b: clamp(c.b), a: clamp(c.a ?? 1) });
// Reduce OKLCH chroma until the colour fits sRGB; hue and lightness are kept.
export function gamutMap(c) {
  if (inGamut(c)) return clampColor(c);
  const { L, C, h } = toOklch(c);
  if (L >= 1) return { r: 1, g: 1, b: 1, a: c.a };
  if (L <= 0) return { r: 0, g: 0, b: 0, a: c.a };
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(fromOklch({ L, C: mid, h }), 0.0001)) lo = mid;
    else hi = mid;
  }
  return clampColor(fromOklch({ L, C: lo, h }, c.a));
}
export const luminance = (c) => { const k = clampColor(c); return 0.2126 * toLin(k.r) + 0.7152 * toLin(k.g) + 0.0722 * toLin(k.b); };
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export const wcagLevel = (ratio) => (ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA large" : "fail");

const namedList = Object.entries(NAMED).map(([name, hex]) => [name, fromHex6(hex)]);
export function nearestName(c) {
  const lab = toOklab(clampColor(c));
  let best = ["black", 9];
  for (const [name, color] of namedList) {
    const o = toOklab(color);
    const d = (o.L - lab.L) ** 2 + (o.a - lab.a) ** 2 + (o.b - lab.b) ** 2;
    if (d < best[1]) best = [name, d];
  }
  return { name: best[0], exact: best[1] < 1e-6 };
}

// ---- parsing ----------------------------------------------------------------
const NUM = "[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[-+]?\\d+)?";
const TOKEN = new RegExp(`^(none|${NUM})(%|deg|turn|grad|rad)?$`, "i");
function token(raw, { percentOf = 1, hue = false } = {}) {
  const m = TOKEN.exec(String(raw).trim());
  if (!m) return null;
  if (m[1].toLowerCase() === "none") return 0;
  let v = Number(m[1]);
  const unit = (m[2] ?? "").toLowerCase();
  if (hue) return unit === "turn" ? v * 360 : unit === "grad" ? v * 0.9 : unit === "rad" ? (v * 180) / Math.PI : unit === "%" ? null : v;
  if (unit === "%") v = (v / 100) * percentOf;
  else if (unit) return null;
  return v;
}
const split = (body) => {
  const [main, alpha] = body.split("/").map((s) => s.trim());
  const parts = main.split(/[\s,]+/).filter(Boolean);
  if (alpha === undefined && parts.length === 4) return [parts.slice(0, 3), parts[3], 4];
  return [parts, alpha, parts.length];
};

// parseColor("rgb(10 20 30 / 50%)") -> { ok: true, color, format } or { ok: false, error }.
export function parseColor(input) {
  const text = String(input ?? "").trim();
  if (!text) return { ok: false, error: "Enter a colour." };
  const lower = text.toLowerCase();
  if (lower === "transparent") return { ok: true, color: { r: 0, g: 0, b: 0, a: 0 }, format: "name" };
  if (NAMED[lower]) return { ok: true, color: fromHex6(NAMED[lower]), format: "name" };
  const hex = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
  if (hex && (text.startsWith("#") || hex[1].length === 6 || hex[1].length === 8)) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const c = fromHex6(h);
    if (h.length === 8) c.a = parseInt(h.slice(6, 8), 16) / 255;
    return { ok: true, color: c, format: h.length === 8 ? "hex8" : "hex" };
  }
  const fn = /^([a-z-]+)\(\s*([^)]*)\)$/i.exec(text);
  if (!fn) return { ok: false, error: "Not a colour. Try a name, #3366cc, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch() or cmyk()." };
  const name = fn[1].toLowerCase();
  if (name === "color") {
    // color(srgb r g b / a), the form browsers report for computed colours.
    const [head, alphaPart] = fn[2].split("/").map((x) => x.trim());
    const bits = head.split(/\s+/);
    if (bits[0] !== "srgb" || bits.length !== 4) return { ok: false, error: "Only color(srgb r g b) is supported." };
    const v = bits.slice(1).map((x) => token(x, { percentOf: 1 }));
    const a = alphaPart === undefined ? 1 : token(alphaPart, { percentOf: 1 });
    if (v.includes(null) || a === null) return { ok: false, error: "Could not read the color() values." };
    return { ok: true, color: { r: v[0], g: v[1], b: v[2], a }, format: "srgb" };
  }
  const [p, alphaRaw, count] = split(fn[2]);
  const alpha = alphaRaw === undefined ? 1 : token(alphaRaw, { percentOf: 1 });
  if (alpha === null || alpha < 0 || alpha > 1.0000001) return { ok: false, error: "Alpha must be 0 to 1, or 0% to 100%." };
  const bad = (what) => ({ ok: false, error: `Could not read the ${what} value.` });
  const out = (color, format) => ({ ok: true, color: { ...color, a: alpha }, format });
  const three = () => (p.length === 3 && count >= 3 ? null : { ok: false, error: `${name}() needs 3 values.` });
  const num = (i, o) => token(p[i] ?? "", o);
  const share = (v) => clamp(v > 1 ? v / 100 : v);
  let problem;
  switch (name) {
    case "rgb": case "rgba": {
      if ((problem = three())) return problem;
      const isPct = p.some((v) => v.endsWith("%"));
      const v = p.map((x) => token(x, { percentOf: isPct ? 1 : 255 }));
      if (v.includes(null)) return bad("red, green or blue");
      return out(isPct ? { r: v[0], g: v[1], b: v[2] } : { r: v[0] / 255, g: v[1] / 255, b: v[2] / 255 }, "rgb");
    }
    case "hsl": case "hsla": case "hsv": case "hsb": case "hwb": {
      if ((problem = three())) return problem;
      const [h, s, l] = [num(0, { hue: true }), num(1, { percentOf: 1 }), num(2, { percentOf: 1 })];
      if ([h, s, l].includes(null)) return bad("hue or percentage");
      if (name.startsWith("hsl")) return out(fromHsl({ h, s: share(s), l: share(l) }), "hsl");
      if (name === "hwb") return out(fromHwb({ h, w: share(s), bl: share(l) }), "hwb");
      return out(fromHsv({ h, s: share(s), v: share(l) }), "hsv");
    }
    case "lab": case "oklab": {
      if ((problem = three())) return problem;
      const ok = name === "oklab";
      const [L, a, b] = [num(0, { percentOf: ok ? 1 : 100 }), num(1, { percentOf: ok ? 0.4 : 125 }), num(2, { percentOf: ok ? 0.4 : 125 })];
      if ([L, a, b].includes(null)) return bad("lightness, a or b");
      return out((ok ? fromOklab : fromLab)({ L, a, b }), name);
    }
    case "lch": case "oklch": {
      if ((problem = three())) return problem;
      const ok = name === "oklch";
      const [L, C, h] = [num(0, { percentOf: ok ? 1 : 100 }), num(1, { percentOf: ok ? 0.4 : 150 }), num(2, { hue: true })];
      if ([L, C, h].includes(null)) return bad("lightness, chroma or hue");
      return out((ok ? fromOklch : fromLch)({ L, C: Math.max(0, C), h }), name);
    }
    case "cmyk": case "device-cmyk": {
      const four = fn[2].split("/")[0].trim().split(/[\s,]+/).filter(Boolean);
      if (four.length !== 4) return { ok: false, error: "cmyk() needs 4 values." };
      const v = four.map((x) => token(x, { percentOf: 1 }));
      if (v.includes(null)) return bad("cyan, magenta, yellow or black");
      const f = v.map(share);
      return { ok: true, color: fromCmyk({ c: f[0], m: f[1], y: f[2], k: f[3] }), format: "cmyk" };
    }
    default:
      return { ok: false, error: `Unknown colour function ${name}().` };
  }
}

// ---- formatting -------------------------------------------------------------
const h2 = (v) => Math.round(clamp(v) * 255).toString(16).padStart(2, "0");
const al = (c) => (c.a < 0.9995 ? ` / ${round(c.a, 3)}` : "");
export const FORMATS = ["hex", "hex8", "rgb", "hsl", "hsv", "hwb", "lab", "lch", "oklab", "oklch", "cmyk", "name"];
export function format(c, kind) {
  const k = clampColor(c);
  switch (kind) {
    case "hex": return `#${h2(k.r)}${h2(k.g)}${h2(k.b)}`;
    case "hex8": return `#${h2(k.r)}${h2(k.g)}${h2(k.b)}${h2(k.a)}`;
    case "rgb": return `rgb(${Math.round(k.r * 255)} ${Math.round(k.g * 255)} ${Math.round(k.b * 255)}${al(k)})`;
    case "hsl": { const v = toHsl(k); return `hsl(${round(v.h, 1)} ${round(v.s * 100, 1)}% ${round(v.l * 100, 1)}%${al(k)})`; }
    case "hsv": { const v = toHsv(k); return `hsv(${round(v.h, 1)} ${round(v.s * 100, 1)}% ${round(v.v * 100, 1)}%${al(k)})`; }
    case "hwb": { const v = toHwb(k); return `hwb(${round(v.h, 1)} ${round(v.w * 100, 1)}% ${round(v.bl * 100, 1)}%${al(k)})`; }
    case "lab": { const v = toLab(c); return `lab(${round(v.L, 2)} ${round(v.a, 2)} ${round(v.b, 2)}${al(k)})`; }
    case "lch": { const v = toLch(c); return `lch(${round(v.L, 2)} ${round(v.C, 2)} ${round(v.h, 1)}${al(k)})`; }
    case "oklab": { const v = toOklab(c); return `oklab(${round(v.L, 4)} ${round(v.a, 4)} ${round(v.b, 4)}${al(k)})`; }
    case "oklch": { const v = toOklch(c); return `oklch(${round(v.L, 4)} ${round(v.C, 4)} ${round(v.h, 1)}${al(k)})`; }
    case "cmyk": { const v = toCmyk(k); return `cmyk(${round(v.c * 100, 1)}% ${round(v.m * 100, 1)}% ${round(v.y * 100, 1)}% ${round(v.k * 100, 1)}%)`; }
    case "name": { const n = nearestName(k); return n.exact ? n.name : `≈ ${n.name}`; }
    default: return "";
  }
}

// Everything the translator shows for one colour, with honest warnings.
export function translate(c) {
  const fits = inGamut(c);
  const mapped = fits ? clampColor(c) : gamutMap(c);
  const warnings = [];
  if (!fits) warnings.push("This colour is outside the sRGB range of most screens. The sRGB values below are the closest colour that fits (chroma reduced, hue and lightness kept).");
  if (c.a < 1) warnings.push("Alpha is kept in every format that can hold it. CMYK and the name cannot hold alpha, so they describe the opaque colour.");
  warnings.push("CMYK here is the simple device formula, not a printer profile, so a print shop may see different ink amounts.");
  const wide = new Set(["lab", "lch", "oklab", "oklch"]);
  const rows = Object.fromEntries(FORMATS.map((f) => [f, format(wide.has(f) ? c : mapped, f)]));
  return { rows, inGamut: fits, mapped, warnings, contrastWhite: contrast(mapped, { r: 1, g: 1, b: 1, a: 1 }), contrastBlack: contrast(mapped, { r: 0, g: 0, b: 0, a: 1 }) };
}
