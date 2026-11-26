// Start-up guard. A plain script (not a module) loaded before the app, written in
// old, widely supported JavaScript so it still runs when the app itself cannot.
// If the app reports that it failed to start, or has not started after 30 seconds, this replaces the blank
// page with the error and two ways out: try again, or clear what this browser has
// saved for the app (theme, tabs, layout and similar) and try again.
(function () {
  var shown = false;
  var errors = [];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function clearSaved() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("mar.") === 0) keys.push(k);
      }
      for (var j = 0; j < keys.length; j++) localStorage.removeItem(keys[j]);
    } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    // (the flag that says settings were cleared is set again right after, by the button)
  }

  function show(reason, force) {
    var root = document.getElementById("app");
    if (shown || !root || (window.__marStarted && !force)) return;
    shown = true;
    var card = el("section", "card bad");
    card.appendChild(el("h1", "disp", "The app could not start"));
    card.appendChild(el("p", "lede", "Something stopped the app before it could show anything. Try again first. If the page stays blank, clear what this browser has saved for the app; your account and router settings are kept on the server."));
    var detail = el("pre", "boot-error", reason || "No error was reported.");
    card.appendChild(detail);
    var actions = el("div", "actions");
    var clear = el("button", "btn o", "Clear saved settings and retry");
    clear.type = "button";
    clear.onclick = function () { clearSaved(); try { sessionStorage.setItem("mar.boot.cleared", "1"); } catch (e) {} location.reload(); };
    var retry = el("button", "btn f", "Try again");
    retry.type = "button";
    retry.onclick = function () { location.reload(); };
    actions.appendChild(clear);
    actions.appendChild(retry);
    card.appendChild(actions);
    var center = el("div", "center");
    center.appendChild(card);
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(center);
  }

  function describe(e) {
    if (!e) return "";
    if (e.message) return e.message + (e.filename ? " (" + e.filename.replace(location.origin, "") + ":" + e.lineno + ")" : "");
    return String(e);
  }

  window.addEventListener("error", function (e) {
    errors.push(describe(e.error && e.error.stack ? { message: String(e.error.stack).split("\n").slice(0, 3).join("\n") } : e));
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    errors.push(r && r.stack ? String(r.stack).split("\n").slice(0, 3).join("\n") : describe(r));
  });
  setTimeout(function () {
    var root = document.getElementById("app");
    if (root && !window.__marStarted) show(errors.join("\n") || "The app took too long to start.");
  }, 30000);
  window.__marBootFailed = function (error) { show(error && error.stack ? String(error.stack).split("\n").slice(0, 4).join("\n") : describe(error), true); };
})();
