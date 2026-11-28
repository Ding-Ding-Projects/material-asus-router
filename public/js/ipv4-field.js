// The four-box IPv4 address field used by the ipv4, cidr and range controls.
import { h, t } from "./core.js";

export function ipv4Field(value, onChange, disabled) {
  const parts = String(value || "").split(".");
  while (parts.length < 4) parts.push("");
  const inputs = [0, 1, 2, 3].map((i) =>
    h("input", {
      class: "oct",
      inputmode: "numeric",
      maxlength: "3",
      autocomplete: "off",
      "aria-label": t(`Part ${i + 1} of the address`, `地址第 ${i + 1} 部分`),
      value: parts[i],
      disabled,
      onInput(e) {
        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 3);
        const hadDot = /\./.test(e.target.value);
        e.target.value = cleaned;
        if (i < 3 && (cleaned.length === 3 || (hadDot && cleaned))) inputs[i + 1].focus();
        const joined = inputs.map((x) => x.value);
        onChange(joined.every((x) => x === "") ? "" : joined.join("."));
      },
      onKeydown(e) {
        if (e.key === "Backspace" && !e.target.value && i > 0) inputs[i - 1].focus();
        if (e.key === "." && i < 3) (e.preventDefault(), inputs[i + 1].focus());
      },
    }),
  );
  const wrap = h("span", { class: "ipv4", role: "group" });
  // append() turns null into the text "null", so the dot is only passed where there is one.
  inputs.forEach((input, i) => (i ? wrap.append(h("span", { "aria-hidden": "true" }, "."), input) : wrap.append(input)));
  return { el: wrap, set: (v) => String(v).split(".").forEach((p, i) => inputs[i] && (inputs[i].value = p)) };
}
