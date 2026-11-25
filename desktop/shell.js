const $ = (id) => document.getElementById(id);
$("min").addEventListener("click", () => window.desktop.minimize());
$("max").addEventListener("click", () => window.desktop.toggleMaximize());
$("close").addEventListener("click", () => window.desktop.close());
$("menu").addEventListener("click", () => {
  const r = $("menu").getBoundingClientRect();
  window.desktop.menu(Math.round(r.left), Math.round(r.bottom));
});
window.desktop.onState(({ maximized }) => {
  $("max").setAttribute("aria-label", maximized ? "Restore" : "Maximize");
  $("max").title = maximized ? "Restore" : "Maximize";
  $("maxpath").setAttribute("d", maximized ? "M8 6h10v10h-1.6V7.6H8zM6 8h10v10H6zm1.6 1.6v6.8h6.8V9.6z" : "M6 6h12v12H6zm1.6 1.6v8.8h8.8V7.6z");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "F10") {
    e.preventDefault();
    $("menu").click();
  }
});
