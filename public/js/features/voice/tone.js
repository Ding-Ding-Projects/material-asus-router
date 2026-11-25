// Funny levels. Two independent sliders (English and Cantonese), 1 to 5, change
// the VOICE of a message and never its facts: a short aside is added after the
// message, and the message itself is left exactly as written. Level 1 adds
// nothing at all, so level 1 and level 5 always carry identical facts.
//
// Categories follow the kind of message, so errors, destructive confirmations,
// security notes and accessibility announcements are all covered, not only the
// cheerful ones.

export const LEVELS = [1, 2, 3, 4, 5];
export const CATEGORIES = ["error", "success", "confirm", "security", "access", "empty"];

export const LEVEL_NAMES = {
  en: ["Serious", "Calm", "Friendly", "Playful", "Full fun"],
  yue: ["認真", "平靜", "友善", "有趣", "搞笑"],
};

// ASIDES[language][category][level - 1]; level 1 is always empty.
export const ASIDES = {
  en: {
    error: ["", "We are sorry about that.", "That did not go to plan.", "Well, that did not go to plan. Even routers have off days.", "Oops! A packet took a wrong turn somewhere and is still looking for the exit."],
    success: ["", "All good.", "That worked nicely.", "Smooth. The router barely noticed.", "Ta-da! The router is quietly very proud of itself."],
    confirm: ["", "Please take a moment before you continue.", "This is the careful kind of button.", "Big button ahead. Take a breath first.", "This is the serious kind of button. Breathe in, breathe out, then decide."],
    security: ["", "Safety matters here.", "Your network's safety comes first.", "The router is being extra careful, like a goalkeeper in the last minute.", "Bouncer mode: ON. Nobody gets past without a good reason."],
    access: ["", "Announced for you.", "Said out loud so nothing is missed.", "Heard loud and clear.", "Your friendly announcer has spoken!"],
    empty: ["", "Quiet for now.", "Nothing to see, which is fine.", "Crickets. Peaceful, relaxing crickets.", "So empty that even the dust bunnies left."],
  },
  yue: {
    error: ["", "唔好意思。", "呢次唔夠順利。", "唉，今次唔係好順利，路由器都有狀態唔好嘅日子㗎。", "哎呀！有個封包行錯咗路，到而家都仲搵緊出口。"],
    success: ["", "搞掂。", "做得好順。", "好順呀，路由器幾乎冇留意到。", "叮！路由器偷偷哋好自豪。"],
    confirm: ["", "繼續之前請諗一諗。", "呢個係要小心嘅掣。", "前面係大掣，先深呼吸一下。", "呢個係認真嘅掣，深呼吸，然後先決定。"],
    security: ["", "安全好重要。", "網絡安全永遠擺第一。", "路由器而家特別小心，好似守龍門最後一分鐘咁。", "保安模式：開啟。冇好理由就唔俾過。"],
    access: ["", "已經同你講咗。", "讀出嚟，唔會漏咗。", "聽得一清二楚。", "你嘅友善播報員已經講完喇！"],
    empty: ["", "暫時靜靜哋。", "冇嘢睇都冇問題。", "得返蟋蟀聲，好平靜嘅蟋蟀聲。", "空到連灰塵都搬走晒。"],
  },
};

// One decorative emoji per dialog. It is aria-hidden, sits in the heading only
// (never in a button, a label or an accessible name) and carries no meaning.
export const DIALOG_EMOJI = ["✨", "🍵", "🥟", "🎈", "🌈", "🧩", "🎐", "🍀"];

export function aside(category, level, language) {
  const list = ASIDES[language]?.[category];
  if (!list) return "";
  const i = Math.min(5, Math.max(1, Math.round(Number(level) || 5))) - 1;
  return list[i];
}

// The aside text for the language mode: English only, Cantonese only, or both
// (each language at its own level).
export function asideFor(category, tone, mode) {
  const en = aside(category, tone.en, "en");
  const yue = aside(category, tone.yue, "yue");
  if (mode === "en") return en;
  if (mode === "yue") return yue;
  return [en, yue].filter(Boolean).join("\n");
}

// Which message category an element in the app belongs to. The rules use the
// classes the app already puts on its messages.
const SECURITY_ICONS = new Set(["shield", "lock", "key", "vpn_key", "security", "gpp_maybe", "admin_panel_settings", "verified_user"]);
export const RULES = [
  { category: "error", match: (el) => el.matches?.(".toast.bad, .card.bad, .note.bad") },
  { category: "success", match: (el) => el.matches?.(".toast:not(.bad)") },
  { category: "confirm", match: (el) => el.matches?.("dialog .sheet") && Boolean(el.querySelector?.(".btn.d")) },
  // Only warnings about security: a shield, lock or key icon, or an explicit marker.
  { category: "security", match: (el) => Boolean(el.matches?.("[data-tone='security']") || (el.matches?.(".note.warn, .card.warn") && [...(el.querySelectorAll?.(".ms") ?? [])].some((i) => SECURITY_ICONS.has(i.textContent.trim())))) },
  { category: "empty", match: (el) => el.matches?.(".empty") },
];

export function emojiFor(title) {
  let hash = 0;
  for (const ch of String(title)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return DIALOG_EMOJI[hash % DIALOG_EMOJI.length];
}
