// The process list: what is running on the router, refreshed while it is open.
// Only programs the person started have a Stop button; the router's own
// programs are shown, never offered.
const BASE = "/api/x/ssh-actions";

export function openProcesses(ctx) {
  const { api, h, icon, t, openDialog, confirmDialog, toast, state } = ctx;
  const body = h("tbody", {});
  const note = h("div", { class: "t2", role: "status" });
  const filter = h("input", { class: "field", type: "search", placeholder: t("Filter by name or number", "按名稱或編號篩選"), "aria-label": t("Filter by name or number", "按名稱或編號篩選") });
  let list = [];
  let timer = null;
  let closed = false;

  const draw = () => {
    const q = filter.value.trim().toLowerCase();
    body.replaceChildren(...list.filter((p) => !q || `${p.pid} ${p.command}`.toLowerCase().includes(q)).map((p) => h("tr", { class: p.stoppable ? "" : "sa-sys" },
      h("td", { class: "mono" }, String(p.pid)),
      h("td", {}, p.user),
      h("td", { class: "mono" }, p.memory),
      h("td", { class: "mono sa-cmdcell" }, p.command),
      h("td", {}, p.stoppable
        ? h("button", { class: "btn t sm", disabled: !state.canWrite, "aria-label": `${t("Stop", "停止")} ${p.pid}`, onClick: () => stop(p) }, icon("stop_circle", "sm"), t("Stop", "停止"))
        : h("span", { class: "tag" }, icon("lock", "sm"), t("Router's own", "路由器自己嘅"))))));
  };
  async function refresh() {
    try {
      list = (await api.get(`${BASE}/processes`)).processes;
      note.textContent = t(`${list.length} processes. Updated ${new Date().toLocaleTimeString()}.`, `${list.length} 個程序，更新於 ${new Date().toLocaleTimeString()}。`);
      draw();
    } catch (error) {
      note.textContent = error.message;
    }
    if (!closed) timer = setTimeout(refresh, 3000);
  }
  async function stop(p) {
    if (!(await confirmDialog({ title: t(`Stop process ${p.pid}?`, `停止程序 ${p.pid}？`), body: p.command, confirm: t("Stop it", "停止"), danger: true }))) return;
    try {
      await api.post(`${BASE}/run`, { id: "stop-process", params: { pid: p.pid }, ack: true });
      toast(t("Stop signal sent.", "已送出停止訊號。"));
      clearTimeout(timer);
      refresh();
    } catch (error) {
      toast(error.message, "bad");
    }
  }
  filter.addEventListener("input", draw);
  const dialog = openDialog((close) => [
    h("h2", { class: "h2" }, t("Running processes", "運行緊嘅程序")),
    h("div", { class: "t2" }, t("Only programs you started (from /opt, /jffs or a USB drive) and plain tools can be stopped. The rest belong to the router.", "只可以停止你自己開嘅程式（喺 /opt、/jffs 或 USB）同普通工具，其餘屬於路由器。")),
    filter, note,
    h("div", { class: "sa-tablewrap" }, h("table", { class: "sa-table" }, h("thead", {}, h("tr", {}, ["PID", t("User", "用戶"), t("Memory", "記憶體"), t("Command", "命令"), ""].map((x) => h("th", { scope: "col" }, x)))), body)),
    h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => close() }, t("Close", "關閉"))),
  ], { label: t("Running processes", "運行緊嘅程序") });
  dialog.closed.then(() => { closed = true; clearTimeout(timer); });
  refresh();
  return dialog;
}
