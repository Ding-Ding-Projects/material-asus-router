// Small pure helpers for the network map editor screen.

// Words for a link grade. The label and an icon carry the meaning, not the colour alone.
export function gradeCopy(grade) {
  return (
    {
      great: { tag: "good", icon: "signal_cellular_alt", label: { en: "Great", yue: "好好" } },
      ok: { tag: "warn", icon: "signal_cellular_alt_2_bar", label: { en: "Okay", yue: "一般" } },
      weak: { tag: "bad", icon: "signal_cellular_alt_1_bar", label: { en: "Weak", yue: "偏弱" } },
    }[grade] ?? { tag: "", icon: "help", label: { en: "Not measured", yue: "未量度" } }
  );
}

// A name cut to fit a chip, with an ellipsis, never in the middle of a pair of characters.
export function shortName(text, max) {
  const chars = [...String(text ?? "")];
  return chars.length <= max ? chars.join("") : `${chars.slice(0, max - 1).join("")}…`;
}
