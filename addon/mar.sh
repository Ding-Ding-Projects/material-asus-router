#!/bin/sh
# Material Asus Router add-on control for Asuswrt-Merlin.
#   mar.sh start|stop|restart|status     run the app (only when switched on)
#   mar.sh enable|disable                the on/off switch, also set from the router's web page
#   mar.sh update [archive]               install a new version into the spare slot, health-check, switch
#   mar.sh rollback                       go back to the previous slot
#   mar.sh service-event <action> <name>  called by /jffs/scripts/service-event
# Paths can be moved under a test root with MAR_ROOT. Nothing here restarts the router.

ROOT="${MAR_ROOT:-}"
NAME="material-asus-router"
ADDON_DIR="$ROOT/jffs/addons/$NAME"
APP_BASE="$ROOT/opt/share/$NAME"
DATA_DIR="$ROOT/opt/var/$NAME"
PIDFILE="$ROOT/tmp/$NAME.pid"
LOG="$ROOT/tmp/$NAME.log"
SETTINGS="$ROOT/jffs/addons/custom_settings.txt"
REPO="Ding-Ding-Projects/material-asus-router"
NODE="${MAR_NODE:-$ROOT/opt/bin/node}"

say() { echo "material-asus-router: $*"; logger -t "$NAME" "$*" 2>/dev/null || true; }

setting() { # setting <name> [default]
  v=""
  [ -f "$SETTINGS" ] && v="$(sed -n "s/^mar_$1 //p" "$SETTINGS" | tail -n 1)"
  [ -n "$v" ] && echo "$v" || echo "${2:-}"
}

set_setting() { # set_setting <name> <value>
  mkdir -p "$(dirname "$SETTINGS")"
  touch "$SETTINGS"
  grep -v "^mar_$1 " "$SETTINGS" > "$SETTINGS.new" 2>/dev/null || true
  echo "mar_$1 $2" >> "$SETTINGS.new"
  mv "$SETTINGS.new" "$SETTINGS"
}

lan_ip() {
  if [ -n "${MAR_LAN_IP:-}" ]; then echo "$MAR_LAN_IP"; else nvram get lan_ipaddr 2>/dev/null; fi
}
port() { setting port 8790; }

# Prints the first line of a file (the pid file, the saved page name) using the shell's own read.
readfile() { [ -f "$1" ] && IFS= read -r line < "$1" && echo "$line"; }

running() { [ -f "$PIDFILE" ] && kill -0 "$(readfile "$PIDFILE")" 2>/dev/null; }

healthy() { # healthy <seconds>
  url="http://$(lan_ip):$(port)/health"
  n=0
  while [ "$n" -lt "$1" ]; do
    if [ -x "$NODE" ]; then
      "$NODE" -e "fetch(process.argv[1],{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" "$url" 2>/dev/null && return 0
    elif command -v curl >/dev/null 2>&1; then curl -fsS -m 3 "$url" >/dev/null 2>&1 && return 0
    else wget -q -T 3 -O /dev/null "$url" 2>/dev/null && return 0; fi
    sleep 1
    n=$((n + 1))
  done
  return 1
}

start() {
  if [ "$(setting enabled 0)" != "1" ]; then say "switched off; not starting"; return 0; fi
  if running; then say "already running"; return 0; fi
  [ -x "$NODE" ] || { say "Node.js is missing at $NODE. Install it with: opkg install node"; return 1; }
  [ -f "$APP_BASE/current/server/index.mjs" ] || { say "no app installed in $APP_BASE/current"; return 1; }
  ip="$(lan_ip)"
  case "$ip" in ""|0.0.0.0) say "the router's home network address is unknown; not starting"; return 1 ;; esac
  mkdir -p "$DATA_DIR"
  cd "$APP_BASE/current" || return 1
  PORT="$(port)" BIND_ADDRESS="$ip" DATA_DIR="$DATA_DIR" ROUTER_SUGGESTED_HOST=127.0.0.1 \
    nohup "$NODE" server/index.mjs >> "$LOG" 2>&1 &
  echo $! > "$PIDFILE"
  say "started on http://$ip:$(port)/"
}

stop() {
  if running; then
    kill "$(readfile "$PIDFILE")" 2>/dev/null
    n=0
    while running && [ "$n" -lt 10 ]; do sleep 1; n=$((n + 1)); done
    running && kill -9 "$(readfile "$PIDFILE")" 2>/dev/null
    say "stopped"
  fi
  rm -f "$PIDFILE"
}

status() {
  if running; then echo "running (pid $(readfile "$PIDFILE")) on http://$(lan_ip):$(port)/, slot $(readlink "$APP_BASE/current" | sed 's#.*/##')"
  else echo "stopped ($( [ "$(setting enabled 0)" = 1 ] && echo switched on || echo switched off))"; fi
}

active_slot() { readlink "$APP_BASE/current" 2>/dev/null | sed 's#.*/##'; }
spare_slot() { [ "$(active_slot)" = "a" ] && echo b || echo a; }

switch_to() { # switch_to <slot>
  # mv onto a link to a folder would move the new link into that folder, so replace it directly.
  # The app is stopped while this runs, so the moment without a link does not matter.
  rm -f "$APP_BASE/current"
  ln -s "$APP_BASE/slots/$1" "$APP_BASE/current"
}

verify_archive() { # verify_archive <archive> <sums file>
  want="$(grep " $(basename "$1")\$" "$2" | cut -d' ' -f1)"
  got="$(sha256sum "$1" | cut -d' ' -f1)"
  [ -n "$want" ] && [ "$want" = "$got" ]
}

update() { # update [archive]
  work="$ROOT/tmp/$NAME-update"
  rm -rf "$work"; mkdir -p "$work"
  if [ -n "${1:-}" ]; then
    archive="$1"
  else
    base="https://github.com/$REPO/releases/latest/download"
    archive="$work/$NAME-addon.tar.gz"
    curl -fsSL -o "$archive" "$base/$NAME-addon.tar.gz" || { say "download failed"; return 1; }
    curl -fsSL -o "$work/SHA256SUMS.txt" "$base/SHA256SUMS.txt" || { say "checksum download failed"; return 1; }
    verify_archive "$archive" "$work/SHA256SUMS.txt" || { say "checksum mismatch; nothing changed"; return 1; }
  fi
  old="$(active_slot)"
  new="$(spare_slot)"
  unpacked="$work/unpacked"
  rm -rf "$unpacked"; mkdir -p "$unpacked"
  tar -xzf "$archive" -C "$unpacked" || { say "could not unpack; nothing changed"; return 1; }
  # A release archive holds the scripts and app/; a bare app archive holds server/ at the top.
  src="$unpacked"
  [ -f "$unpacked/app/server/index.mjs" ] && src="$unpacked/app"
  [ -f "$src/server/index.mjs" ] || { say "the archive has no app; nothing changed"; return 1; }
  rm -rf "$APP_BASE/slots/$new"; mkdir -p "$APP_BASE/slots"
  mv "$src" "$APP_BASE/slots/$new" || { say "could not place the new version; nothing changed"; return 1; }
  # The release archive also carries newer scripts and the router page; keep them in step.
  # Copy then rename, so this running script is replaced as a whole and never edited in place.
  for f in mar.sh uninstall.sh; do
    [ -f "$unpacked/$f" ] && cp "$unpacked/$f" "$ADDON_DIR/$f.new" && chmod 755 "$ADDON_DIR/$f.new" && mv -f "$ADDON_DIR/$f.new" "$ADDON_DIR/$f"
  done
  [ -f "$unpacked/webui/mar.asp" ] && cp "$unpacked/webui/mar.asp" "$ADDON_DIR/mar.asp"
  was_running=0; running && was_running=1
  stop
  switch_to "$new"
  say "switched to slot $new"
  if [ "$was_running" = 1 ] || [ "$(setting enabled 0)" = 1 ]; then
    start
    if ! healthy 60; then
      say "the new version did not answer; going back to slot ${old:-none}"
      stop
      [ -n "$old" ] && switch_to "$old" && start
      # The failed copy took the spare slot, which held the version before; that one is gone now.
      rm -rf "$APP_BASE/slots/$new"
      set_setting previous ""
      rm -rf "$work"
      return 1
    fi
  fi
  set_setting previous "$old"
  rm -rf "$work"
  say "update finished on slot $new"
}

rollback() {
  prev="$(setting previous)"
  [ -n "$prev" ] && [ -d "$APP_BASE/slots/$prev" ] || { say "there is no previous version"; return 1; }
  cur="$(active_slot)"
  stop; switch_to "$prev"; set_setting previous "$cur"; start
  say "rolled back to slot $prev"
}

# The router web page: Merlin's add-on helper picks a free user page and the Tools menu gets a tab.
webui() {
  . /usr/sbin/helper.sh
  am_get_webui_page "$ADDON_DIR/mar.asp"
  if [ "$am_webui_page" = "none" ]; then say "the router has no free add-on page left"; return 1; fi
  cp "$ADDON_DIR/mar.asp" "/www/user/$am_webui_page"
  echo "$am_webui_page" > "$ADDON_DIR/webui-page"
  [ -f /tmp/menuTree.js ] || cp /www/require/modules/menuTree.js /tmp/
  if ! grep -q "$am_webui_page" /tmp/menuTree.js; then
    sed -i "/url: \"Tools_OtherSettings.asp\", tabName:/a {url: \"$am_webui_page\", tabName: \"Material Router\"}," /tmp/menuTree.js
  fi
  umount /www/require/modules/menuTree.js 2>/dev/null
  mount -o bind /tmp/menuTree.js /www/require/modules/menuTree.js
}

webui_remove() {
  page="$(readfile "$ADDON_DIR/webui-page")"
  [ -n "$page" ] || return 0
  if [ -f /tmp/menuTree.js ]; then
    sed -i "\~$page~d" /tmp/menuTree.js
    umount /www/require/modules/menuTree.js 2>/dev/null
    mount -o bind /tmp/menuTree.js /www/require/modules/menuTree.js
  fi
  rm -f "/www/user/$page" "$ADDON_DIR/webui-page"
}

case "${1:-}" in
  webui) webui ;;
  webui-remove) webui_remove ;;
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  enable) set_setting enabled 1; start ;;
  disable) set_setting enabled 0; stop ;;
  update) update "${2:-}" ;;
  rollback) rollback ;;
  service-event)
    # The router page applies with action_script "restart_materialrouter": service-event gets "restart" "materialrouter".
    [ "${3:-}" = "materialrouter" ] || exit 0
    if [ "$(setting enabled 0)" = 1 ]; then stop; start; else stop; fi ;;
  *) echo "usage: $0 start|stop|restart|status|enable|disable|update [archive]|rollback"; exit 2 ;;
esac
