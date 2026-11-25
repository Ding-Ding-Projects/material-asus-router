// DNS Pro: which name servers the router uses and how safely. The upstream
// servers and the Dynamic DNS provider and host name are the stock settings,
// drawn here beside this feature's own (DNS over TLS, DNSSEC, DNS Director,
// the Dynamic DNS account). One-tap preset chips fill several settings at
// once, and a host name picker builds the Dynamic DNS name. Every edit waits
// in the pending-changes dock for a preview, the safety net and undo.
import { buildScreen, nowValue } from "./view.js";
import { tableEditor } from "./table.js";

const F = "dns-pro";

export default {
  id: F,
  controls: { dotservers: tableEditor, dnsclients: tableEditor },

  screens: [{
    id: F,
    group: { en: "Network", yue: "網絡" },
    icon: "dns",
    label: { en: "DNS Pro", yue: "DNS 進階" },
    render: (ctx) => buildScreen(ctx, {
      id: F,
      title: { en: "DNS Pro", yue: "DNS 進階" },
      lede: { en: "Choose who answers your name lookups, encrypt them, filter them per device, and keep a name pointing at your home.", yue: "揀邊個回答你嘅域名查詢、加密、按裝置過濾，同埋令一個名稱一直指返你屋企。" },
      // The upstream servers first, then this feature's cards, then Dynamic DNS last.
      entries: (data) => [
        ...data.stock.filter((e) => e.group === "dns"),
        ...data.entries.filter((e) => e.group !== "ddns"),
        ...data.stock.filter((e) => e.group === "ddns"),
        ...data.entries.filter((e) => e.group === "ddns"),
      ],
      before: (data, ctx2, view) => presets(ctx2, data, view),
      after: (data, ctx2, view) => [hostPicker(ctx2, data, view), lookup(ctx2)],
    }),
  }],

  commands: [{
    id: `${F}.lookup`,
    icon: "travel_explore",
    label: { en: "DNS Pro: look a name up through the router", yue: "DNS 進階：經路由器查詢域名" },
    keywords: ["dns", "lookup", "nslookup", "resolve", "查詢"],
    run: (ctx) => ctx.navigate(F),
  }],
};

const entryOf = (data, id) => data.stock.find((e) => e.id === id) ?? data.entries.find((e) => e.id === id);

// Preset chips: provider default, then the public resolvers people usually choose.
function presets(ctx, data, view) {
  const { h, icon, t, tt } = ctx;
  const auto = entryOf(data, "wan.dnsauto");
  const dns1 = entryOf(data, "wan.dns1");
  const dns2 = entryOf(data, "wan.dns2");
  const dotEnable = entryOf(data, `${F}.dot-enable`);
  const dotServers = entryOf(data, `${F}.dot-servers`);
  const locked = !ctx.state.canWrite;
  let encrypted = false;
  const note = h("div", { class: "t2", role: "status", "aria-live": "polite" });
  const holder = h("div", { class: "chips" });
  const withDot = h("input", { type: "checkbox", disabled: locked || !data.merlin, "aria-label": t("Also use encrypted DNS", "同時用加密 DNS"), onChange(e) { encrypted = e.target.checked; } });
  const pick = (preset) => {
    if (locked) return;
    if (preset === "provider") ctx.dock.setEntry(auto, "1");
    else {
      ctx.dock.setEntry(auto, "0");
      ctx.dock.setEntry(dns1, preset.dns[0]);
      ctx.dock.setEntry(dns2, preset.dns[1]);
      if (encrypted && preset.dot && dotEnable && dotServers) {
        ctx.dock.setEntry(dotEnable, "1");
        ctx.dock.setEntry(dotServers, `<${preset.dot.ip}>853>${preset.dot.host}>`);
      }
    }
    view.redraw();
    draw();
    note.textContent = t("Added to your changes. Review and apply them when you are ready.", "已加入改動。準備好就檢視並套用。");
  };
  function draw() {
    const usingProvider = nowValue(ctx, auto) === "1";
    const now = [nowValue(ctx, dns1), nowValue(ctx, dns2)];
    holder.replaceChildren(
      h("button", { class: `chip${usingProvider ? " on" : ""}`, type: "button", "aria-pressed": String(usingProvider), disabled: locked, onClick: () => pick("provider") }, icon("settings_ethernet", "sm"), t("Provider's DNS", "供應商嘅 DNS")),
      ...data.presets.map((p) => {
        const on = !usingProvider && now[0] === p.dns[0] && now[1] === p.dns[1];
        return h("button", { class: `chip${on ? " on" : ""}`, type: "button", title: tt(p.about), "aria-pressed": String(on), disabled: locked, onClick: () => pick(p) }, tt(p.name), h("span", { class: "t2 mono" }, p.dns[0]));
      }));
  }
  draw();
  const bus = ctx.bus.on("dock", draw);
  return {
    stop: bus,
    nodes: h("section", { class: "card tone rise" },
      h("h2", { class: "h2" }, icon("bolt", "sm"), " ", t("Pick a provider in one tap", "一撳揀個供應商")),
      h("div", { class: "t2" }, t("Fills in the two name server addresses for you. Nothing changes on the router until you apply.", "幫你填好兩個域名伺服器地址。套用之前，路由器唔會有任何改變。")),
      holder,
      data.merlin ? h("label", { class: "row" }, withDot, h("span", {}, t("Also use this provider's encrypted DNS (DNS over TLS), where it has one", "同時用呢個供應商嘅加密 DNS（DNS over TLS），如果有嘅話"))) : null,
      note),
  };
}

// Builds the Dynamic DNS name from a short name and a common ending for the chosen provider.
function hostPicker(ctx, data, view) {
  const { h, icon, t } = ctx;
  const host = entryOf(data, "ddns.host");
  const server = entryOf(data, "ddns.server");
  if (!host || !server) return null;
  const locked = !ctx.state.canWrite;
  const current = nowValue(ctx, host);
  const [first = "", ...rest] = current.split(".");
  const name = h("input", { class: "field mono", value: first, disabled: locked, autocomplete: "off", spellcheck: "false", maxlength: "40", "aria-label": t("Your name", "你嘅名稱") });
  const ending = h("select", { class: "field", disabled: locked, "aria-label": t("Ending", "結尾") });
  const out = h("div", { class: "t2 mono", role: "status", "aria-live": "polite" });
  const fill = () => {
    const options = data.suffixes[nowValue(ctx, server)] ?? [];
    ending.replaceChildren(h("option", { value: "" }, options.length ? t("Choose an ending…", "揀個結尾…") : t("Type the whole name in the field above", "喺上面欄位輸入完整名稱")), ...options.map((s) => h("option", { value: s, selected: s === rest.join(".") }, s)));
    ending.disabled = locked || !options.length;
  };
  const apply = () => {
    if (!name.value.trim() || !ending.value) return void (out.textContent = "");
    const full = `${name.value.trim().toLowerCase()}.${ending.value}`;
    ctx.dock.setEntry(host, full);
    out.textContent = full;
    view.redraw();
  };
  name.addEventListener("input", apply);
  ending.addEventListener("change", apply);
  fill();
  const stop = ctx.bus.on("dock", fill);
  return {
    stop,
    nodes: h("section", { class: "card tone rise" },
      h("h2", { class: "h2" }, icon("badge", "sm"), " ", t("Host name picker", "主機名稱揀選器")),
      h("div", { class: "t2" }, t("Pick the ending your provider offers, type your own name in front, and the full host name is filled in above.", "揀供應商提供嘅結尾，喺前面打你自己嘅名稱，上面就會填好完整主機名稱。")),
      h("div", { class: "row" }, h("div", { class: "grow" }, name), h("div", { class: "grow" }, ending)),
      out),
  };
}

// Looks a name up through the router, to prove the chosen servers answer.
function lookup(ctx) {
  const { h, icon, t } = ctx;
  const input = h("input", { class: "field mono", placeholder: "example.test", autocomplete: "off", spellcheck: "false", "aria-label": t("A name to look up", "要查詢嘅域名") });
  const out = h("div", { class: "t2 mono", role: "status", "aria-live": "polite" });
  const run = async () => {
    out.textContent = t("Looking up…", "查詢緊…");
    try {
      const res = await ctx.api.get(`/api/x/${F}/lookup?name=${encodeURIComponent(input.value.trim() || "example.test")}`);
      out.textContent = res.ok ? `${res.name} → ${res.addresses.join(", ")}` : t(`${res.name} did not resolve.`, `${res.name} 解析唔到。`);
    } catch (error) {
      out.textContent = error.message;
    }
  };
  return h("section", { class: "card tone rise" },
    h("h2", { class: "h2" }, icon("travel_explore", "sm"), " ", t("Try a lookup", "試下查詢")),
    h("div", { class: "row" }, h("div", { class: "grow" }, input), h("button", { class: "btn t sm", type: "button", onClick: run }, t("Look up", "查詢"))),
    out);
}
