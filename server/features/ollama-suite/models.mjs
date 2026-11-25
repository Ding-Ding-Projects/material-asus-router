// A starter list of well-known models and the hardware fit check. The official
// catalogue is not fetched (that needs the network and a parser for the
// library page), so this list is labelled as a starting point, and the sizes
// are approximate downloads for the default quantization.
export const RECOMMENDED = [
  { name: "qwen2.5:0.5b", sizeGb: 0.4, about: "Tiny; good for trying the setup.", aboutYue: "好細，適合試用設定。" },
  { name: "llama3.2:1b", sizeGb: 1.3, about: "Small and fast general model.", aboutYue: "細而快嘅通用模型。" },
  { name: "gemma2:2b", sizeGb: 1.6, about: "Small model from Google.", aboutYue: "Google 嘅細模型。" },
  { name: "qwen2.5:3b", sizeGb: 1.9, about: "A good small all-rounder.", aboutYue: "細模型入面算好全面。" },
  { name: "llama3.2:3b", sizeGb: 2.0, about: "Balanced small model.", aboutYue: "平衡嘅細模型。" },
  { name: "phi3:mini", sizeGb: 2.2, about: "Compact reasoning model.", aboutYue: "精簡推理模型。" },
  { name: "codellama:7b", sizeGb: 3.8, about: "Code help.", aboutYue: "寫程式幫手。" },
  { name: "mistral:7b", sizeGb: 4.1, about: "Popular 7B model.", aboutYue: "常用嘅 7B 模型。" },
  { name: "qwen2.5:7b", sizeGb: 4.7, about: "Strong 7B model, many languages.", aboutYue: "夠力嘅 7B 模型，多語言。" },
  { name: "deepseek-r1:7b", sizeGb: 4.7, about: "Reasoning model.", aboutYue: "推理模型。" },
  { name: "llama3.1:8b", sizeGb: 4.9, about: "General 8B model.", aboutYue: "通用 8B 模型。" },
  { name: "gemma2:9b", sizeGb: 5.4, about: "Larger Gemma model.", aboutYue: "較大嘅 Gemma。" },
  { name: "qwen2.5:32b", sizeGb: 20, about: "Large model; needs a strong machine.", aboutYue: "大模型，要部好機。" },
  { name: "llama3.1:70b", sizeGb: 40, about: "Very large; for workstations.", aboutYue: "非常大，適合工作站。" },
];

export const VERDICTS = ["runs-well", "runs-limits", "unlikely", "unknown"];

// Fit verdicts from the model's download size and the memory the person says
// they have. A model needs about 1.25 times its size once it is loaded.
// "runs-well": it fits in video memory. "runs-limits": it fits in memory
// together with video memory, with slower parts running on the processor.
// "unlikely": it does not fit. "unknown": no memory was given.
export function fitVerdict(sizeGb, { ramGb = null, vramGb = null } = {}) {
  const size = Number(sizeGb);
  if (!Number.isFinite(size) || size <= 0) return "unknown";
  const ram = Number(ramGb);
  const vram = Number(vramGb);
  const hasRam = ramGb !== null && ramGb !== "" && Number.isFinite(ram) && ram > 0;
  const hasVram = vramGb !== null && vramGb !== "" && Number.isFinite(vram) && vram >= 0;
  if (!hasRam && !hasVram) return "unknown";
  const need = size * 1.25;
  if (hasVram && vram >= need) return "runs-well";
  if ((hasRam ? ram : 0) + (hasVram ? vram : 0) >= need * 1.5) return "runs-limits";
  return "unlikely";
}

const MODEL_NAME = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)?(:[A-Za-z0-9._-]+)?$/i;
export function modelName(value) {
  const name = String(value ?? "").trim();
  if (!MODEL_NAME.test(name) || name.length > 120) throw Object.assign(new Error(`"${name.slice(0, 40)}" is not a model name. Names look like llama3.2:3b.`), { status: 400 });
  return name;
}
