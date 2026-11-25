// A small always-visible chip at the foot of the navigation rail with the
// running version and when this build was made (local time, with seconds and
// the time zone named). Values come from the build; when they are missing the
// chip says "unavailable" and never shows a guess.
export function formatInstant(iso, locale = undefined) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZoneName: "short" }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} ${get("timeZoneName")} (UTC${sign}${pad(offset / 60)}:${pad(offset % 60)})`;
}

export default {
  id: "front-provenance",
  overlays: [{
    id: "front-provenance.chip",
    mount(ctx) {
      const { api, h, icon, t } = ctx;
      let chip = null;
      let info = null;
      const text = () => {
        const when = info?.updatedAt ? formatInstant(info.updatedAt) : null;
        return `${info?.version ? `v${info.version}` : t("version unavailable", "版本未知")} · ${when ?? t("update time unavailable", "更新時間未知")}`;
      };
      const details = () => ctx.openDialog((close) => [
        h("h2", { class: "h2" }, icon("info"), " ", t("About this build", "關於呢個版本")),
        h("div", { class: "row" }, h("span", { class: "k" }, t("Version", "版本")), h("span", { class: "grow mono" }, info.version ?? t("unavailable", "未知")), info.versionSource ? h("span", { class: "muted" }, info.versionSource) : null),
        h("div", { class: "row" }, h("span", { class: "k" }, t("Updated", "更新於")), h("span", { class: "grow mono" }, info.updatedAt ? formatInstant(info.updatedAt) : t("unavailable", "未知")), h("span", { class: "muted" }, info.updatedAtSource ?? info.updatedAtUnavailable)),
        h("div", { class: "row" }, h("span", { class: "k" }, t("Commit", "Commit")), h("span", { class: "grow mono" }, info.commit ?? t("unavailable", "未知"))),
        h("p", { class: "muted" }, info.beforeSignIn),
        h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => close() }, t("Close", "關閉"))),
      ], { label: t("About this build", "關於呢個版本") });
      const place = () => {
        const rail = document.querySelector(".rail");
        if (!rail || rail.querySelector(".fp-chip")) return;
        chip = h("button", { class: "fp-chip", type: "button", "aria-label": t("Version and update time. Open details.", "版本同更新時間，開啟詳情。"), onClick: () => info && details() }, icon("deployed_code", "sm"), h("span", {}, text()));
        rail.append(chip);
      };
      api.get("/api/x/front-provenance/info").then((out) => {
        info = out;
        place();
        chip?.querySelector("span:last-child")?.replaceChildren(text());
      }, () => {
        info = { version: null, updatedAt: null, updatedAtUnavailable: t("Could not read this build's details.", "讀唔到呢個版本嘅資料。"), beforeSignIn: "" };
        place();
      });
      return () => document.querySelectorAll(".fp-chip").forEach((el) => el.remove());
    },
  }],
};
