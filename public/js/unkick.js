// The Unkick page. No account needed: the router recognises this device by its address, shows
// any pause or ban on it, and one button lifts it. It can only ever touch this device.
(function () {
  var lang = "en";
  try { lang = localStorage.getItem("mar.lang") || ""; } catch (e) {}
  if (!lang) lang = (navigator.language || "").toLowerCase().indexOf("zh") === 0 ? "yue" : "en";
  var both = lang === "both";
  function t(en, yue) { return lang === "yue" ? yue : both ? en + " · " + yue : en; }
  function tt(pair) { return pair ? t(pair.en, pair.yue) : ""; }
  var title = document.getElementById("title");
  var lede = document.getElementById("lede");
  var list = document.getElementById("list");
  var lift = document.getElementById("lift");
  var again = document.getElementById("again");
  document.getElementById("note").textContent = t("This page can only lift a pause on the device you are using now. It never shows anyone else's devices.", "呢頁淨係可以解除你而家用緊嗰部裝置嘅暫停，唔會顯示其他人嘅裝置。");
  lift.textContent = t("Unkick me", "解除我嘅暫停");
  again.textContent = t("Check again", "再檢查");

  function when(iso) {
    if (!iso) return t("until someone lifts it", "直到有人解除");
    var d = new Date(iso);
    var mins = Math.max(0, Math.round((d.getTime() - Date.now()) / 60000));
    return t("until " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) + " (" + mins + " min left)", "直到 " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) + "（仲有 " + mins + " 分鐘）");
  }

  function show(data) {
    while (list.firstChild) list.removeChild(list.firstChild);
    lift.hidden = true;
    again.hidden = false;
    if (!data.found) {
      title.textContent = t("This device is not paused", "呢部裝置冇被暫停");
      lede.textContent = data.reason === "device"
        ? t("The router does not know this device yet. If the internet is not working, ask the person who runs the router.", "路由器未認得呢部裝置。如果上唔到網，問下管路由器嗰個人。")
        : t("Nothing here is paused for the address you are using.", "你而家用緊嘅位址冇被暫停。");
      return;
    }
    if (!data.holds.length) {
      title.textContent = data.lifted ? t("Unkicked. You are back online.", "已解除，你可以再上網。") : t("This device is not paused", "呢部裝置冇被暫停");
      lede.textContent = data.lifted ? t("It can take a few seconds for pages to load again.", "網頁可能要等幾秒先載得返。") : t("Your internet is not paused by this router.", "呢部路由器冇暫停你嘅網絡。");
      return;
    }
    title.textContent = t("Your internet is paused", "你嘅網絡被暫停咗");
    lede.textContent = t("Someone paused this device to share the connection. You can lift it yourself; it is recorded that you did.", "有人為咗分享網絡而暫停咗呢部裝置。你可以自己解除，系統會記低係你解除。");
    data.holds.forEach(function (h) {
      var li = document.createElement("li");
      var head = document.createElement("strong");
      head.textContent = (h.ban ? t("Banned: ", "封鎖：") : t("Kicked: ", "踢走：")) + tt(h.methodLabel);
      var info = document.createElement("span");
      info.textContent = " " + when(h.until) + (h.by ? t(", by " + h.by, "，由 " + h.by) : "") + (h.note ? " · " + h.note : "");
      li.appendChild(head);
      li.appendChild(info);
      list.appendChild(li);
    });
    lift.textContent = data.holds.some(function (h) { return h.ban; }) ? t("Unban me", "解除我嘅封鎖") : t("Unkick me", "解除我嘅暫停");
    lift.hidden = false;
  }

  function fail(message) {
    title.textContent = t("Could not check this device", "檢查唔到呢部裝置");
    lede.textContent = message;
    again.hidden = false;
  }

  function load(method) {
    lift.disabled = true;
    var options = method === "POST" ? { method: "POST", headers: { "x-unkick": "1" } } : {};
    fetch("/api/unkick", options).then(function (r) {
      return r.json().then(function (body) {
        lift.disabled = false;
        if (!r.ok) return fail(body.error || t("Try again in a moment.", "等一陣再試。"));
        show(body);
      });
    }).catch(function () { lift.disabled = false; fail(t("The app did not answer. Try again in a moment.", "程式冇回應，等一陣再試。")); });
  }

  lift.addEventListener("click", function () { load("POST"); });
  again.addEventListener("click", function () { load("GET"); });
  load("GET");
})();
