<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="X-UA-Compatible" content="IE=Edge"/>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta HTTP-EQUIV="Pragma" CONTENT="no-cache">
<meta HTTP-EQUIV="Expires" CONTENT="-1">
<title>Material Router</title>
<link rel="stylesheet" type="text/css" href="index_style.css">
<link rel="stylesheet" type="text/css" href="form_style.css">
<script language="JavaScript" type="text/javascript" src="/state.js"></script>
<script language="JavaScript" type="text/javascript" src="/general.js"></script>
<script language="JavaScript" type="text/javascript" src="/popup.js"></script>
<script language="JavaScript" type="text/javascript" src="/help.js"></script>
<script type="text/javascript" language="JavaScript" src="/validator.js"></script>
<style>
.mar-row{display:flex;align-items:center;gap:16px;margin:14px 0}
.mar-pick{display:flex;gap:10px;margin:10px 0}
.mar-pick label{flex:1;border:1px solid #4d595d;border-radius:8px;padding:12px;cursor:pointer}
.mar-pick input{margin-right:8px}
.mar-note{color:#ffcc00;font-size:12px}
.mar-open{display:inline-block;margin-top:10px;padding:8px 16px;border-radius:16px;background:#5b5bd6;color:#fff !important;text-decoration:none}
</style>
<script>
// The router fills custom_settings from /jffs/addons/custom_settings.txt.
var custom_settings = <% get_custom_settings(); %>;
var CHOICE_KEY = "mar.version"; // remembered by this browser only
function initial() {
  show_menu();
  var on = custom_settings.mar_enabled == "1";
  document.getElementById("mar_on").checked = on;
  document.getElementById("mar_off").checked = !on;
  var port = custom_settings.mar_port || "8790";
  document.getElementById("mar_port").value = port;
  var choice = "material";
  try { choice = localStorage.getItem(CHOICE_KEY) || "material"; } catch (e) {}
  var radio = document.getElementById("mar_v_" + choice);
  if (radio) radio.checked = true;
  updateLink();
}
function chosenVersion() {
  return document.getElementById("mar_v_advanced").checked ? "advanced" : "material";
}
function rememberVersion() {
  try { localStorage.setItem(CHOICE_KEY, chosenVersion()); } catch (e) {}
  updateLink();
}
function updateLink() {
  var link = document.getElementById("mar_link");
  var url = "http://" + location.hostname + ":" + document.getElementById("mar_port").value + "/";
  if (chosenVersion() == "advanced") url += "#/ssh-actions";
  link.href = url;
  link.textContent = "Open the " + (chosenVersion() == "advanced" ? "Advanced version" : "Material version");
  link.style.display = custom_settings.mar_enabled == "1" ? "inline-block" : "none";
}
function applySettings() {
  var port = parseInt(document.getElementById("mar_port").value, 10);
  if (!(port >= 1024 && port <= 65535) || port == 80 || port == 443 || port == 8443) {
    alert("Choose a port from 1024 to 65535 that the router's own pages do not use.");
    return;
  }
  custom_settings.mar_enabled = document.getElementById("mar_on").checked ? "1" : "0";
  custom_settings.mar_port = String(port);
  document.form.amng_custom.value = JSON.stringify(custom_settings);
  showLoading();
  document.form.submit();
}
</script>
</head>
<body onload="initial();">
<div id="TopBanner"></div>
<div id="Loading" class="popup_bg"></div>
<iframe name="hidden_frame" id="hidden_frame" src="" width="0" height="0" frameborder="0"></iframe>
<form method="post" name="form" action="start_apply.htm" target="hidden_frame">
<input type="hidden" name="current_page" value="">
<input type="hidden" name="next_page" value="">
<input type="hidden" name="action_mode" value="apply">
<input type="hidden" name="action_script" value="restart_materialrouter">
<input type="hidden" name="action_wait" value="5">
<input type="hidden" name="amng_custom" value="">
<table class="content" align="center" cellpadding="0" cellspacing="0">
<tr>
<td width="17">&nbsp;</td>
<td valign="top" width="202"><div id="mainMenu"></div><div id="subMenu"></div></td>
<td valign="top">
<div id="tabMenu" class="submenuBlock"></div>
<table width="98%" border="0" align="left" cellpadding="0" cellspacing="0">
<tr><td valign="top">
<table width="760px" border="0" cellpadding="4" cellspacing="0" class="FormTitle" id="FormTitle">
<tr><td bgcolor="#4D595D" valign="top">
<div class="formfonttitle">Material Router</div>
<div style="margin:10px 0 10px 5px;" class="splitLine"></div>
<div class="formfontdesc">A modern app for this router, running on the router itself. It is off unless you switch it on here. Every feature lives in the app, not on these pages.</div>

<div class="mar-row">
  <strong>Material Router</strong>
  <label><input type="radio" name="mar_switch" id="mar_on"> On</label>
  <label><input type="radio" name="mar_switch" id="mar_off"> Off</label>
</div>
<div class="mar-row">
  <label for="mar_port">Port</label>
  <input type="text" id="mar_port" maxlength="5" class="input_6_table" onkeyup="updateLink()">
</div>

<div><strong>Which version opens</strong> (remembered by this browser)</div>
<div class="mar-pick">
  <label><input type="radio" name="mar_version" id="mar_v_material" onclick="rememberVersion()">Material version<br><span class="mar-note">The full modern app.</span></label>
  <label><input type="radio" name="mar_version" id="mar_v_advanced" onclick="rememberVersion()">Advanced version<br><span class="mar-note">Every control, the action catalogue and the terminal.</span></label>
</div>
<a id="mar_link" class="mar-open" target="_blank" rel="noopener">Open</a>

<p class="mar-note">Switching it on or off restarts only this app. The router, Wi-Fi and internet are not touched. The router's own pages still allow one administrator at a time; the app allows many people signed in at once.</p>

<div class="apply_gen"><input name="button" type="button" class="button_gen" onclick="applySettings();" value="Apply"/></div>
</td></tr></table>
</td></tr></table>
</td>
</tr>
</table>
</form>
<div id="footer"></div>
</body>
</html>
