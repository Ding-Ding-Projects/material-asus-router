// The QR card for the Guest party mode. The picture is drawn with the Wi-Fi QR
// feature's own encoder (loaded only when this button is pressed), from the
// guest network the router has switched on right now. If that encoder cannot be
// loaded the button opens the Wi-Fi QR screen instead.
const NS = "http://www.w3.org/2000/svg";

export async function showGuestCard(ctx) {
  const { api, h, icon, t, toast } = ctx;
  try {
    const data = await api.get("/api/domain/wifi-qr");
    const network = data.networks.find((n) => n.kind === "guest" && n.enabled && n.supported);
    if (!network) return toast(t("Turn the Guest party mode on first, so there is a guest network to share.", "請先開請客模式，先有訪客網絡可以分享。"), "warn");
    const secret = await api.post("/api/x/wifi-qr/payload", { id: network.id });
    let qr;
    try {
      qr = await import("/js/features/wifi-qr/qr.js");
    } catch {
      return ctx.navigate("wifi-qr");
    }
    const code = qr.encode(qr.wifiPayload({ ssid: secret.ssid, password: secret.password, security: secret.security, hidden: secret.hidden }), data.level);
    const svg = document.createElementNS(NS, "svg");
    const dim = code.size + 8;
    svg.setAttribute("viewBox", `0 0 ${dim} ${dim}`);
    svg.setAttribute("class", "mode-qr");
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", t(`QR code for ${secret.ssid}`, `${secret.ssid} 嘅 QR 碼`));
    const back = document.createElementNS(NS, "rect");
    back.setAttribute("width", String(dim));
    back.setAttribute("height", String(dim));
    back.setAttribute("fill", "#ffffff");
    const dark = document.createElementNS(NS, "path");
    dark.setAttribute("d", qr.toPath(code, 4));
    dark.setAttribute("fill", "#000000");
    svg.append(back, dark);
    ctx.openDialog(
      (close) => [
        h("h2", { class: "h2" }, t("Guest card", "訪客卡")),
        h("div", { class: "mode-qr-wrap" }, svg),
        h("div", { class: "t1" }, secret.ssid),
        h("p", { class: "muted" }, t("Print this card or show it on a phone. It stops working after 4 hours.", "印張卡或者用手機俾人掃。4 個鐘後失效。")),
        h("div", { class: "actions" },
          h("button", { class: "btn o", onClick: () => close() }, t("Close", "關閉")),
          h("button", { class: "btn f", onClick: () => window.print() }, icon("print", "sm"), t("Print", "列印"))),
      ],
      { label: t("Guest card", "訪客卡") },
    );
  } catch (error) {
    toast(error.message, "bad");
  }
}
