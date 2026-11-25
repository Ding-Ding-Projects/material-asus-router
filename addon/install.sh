#!/bin/sh
# Installs the Material Asus Router add-on on Asuswrt-Merlin. Run it on the router from the
# folder where the release archive was unpacked:  sh install.sh
# It changes nothing in the firmware. It adds:
#   /jffs/addons/material-asus-router/   the control script and the router web page
#   /opt/share/material-asus-router/     two app slots (a and b) and a "current" link
#   two marked lines in /jffs/scripts/services-start, post-mount and service-event
#   a "Material Router" page under the router's Tools menu, with the on/off switch
# The app stays switched off until it is turned on from that page or with: mar.sh enable
# MAR_ROOT moves every path under a test folder; MAR_SKIP_CHECKS=1 skips the router checks there.

set -e
ROOT="${MAR_ROOT:-}"
NAME="material-asus-router"
HERE="$(cd "$(dirname "$0")" && pwd)"
ADDON_DIR="$ROOT/jffs/addons/$NAME"
APP_BASE="$ROOT/opt/share/$NAME"
SCRIPTS="$ROOT/jffs/scripts"
BEGIN="# >>> material-asus-router (added by its installer; remove with its uninstall.sh)"
END="# <<< material-asus-router"

fail() { echo "material-asus-router: $*" >&2; exit 1; }

if [ "${MAR_SKIP_CHECKS:-0}" != 1 ]; then
  [ -f /usr/sbin/helper.sh ] || fail "this router is not running Asuswrt-Merlin, which the add-on needs."
  [ "$(nvram get jffs2_scripts)" = 1 ] || fail "turn on 'Enable JFFS custom scripts and configs' (Administration, System), let the router reboot, then run this again."
  [ -x /opt/bin/opkg ] || fail "Entware is not installed. Plug in a USB drive and install Entware with amtm first."
  [ -x /opt/bin/node ] || fail "Node.js is missing. Install it with: opkg update && opkg install node"
fi
[ -f "$HERE/app/server/index.mjs" ] || fail "run this from the unpacked release folder (app/ is missing)."

# Files
mkdir -p "$ADDON_DIR" "$APP_BASE/slots" "$SCRIPTS"
cp "$HERE/mar.sh" "$HERE/uninstall.sh" "$ADDON_DIR/"
cp "$HERE/webui/mar.asp" "$ADDON_DIR/mar.asp"
chmod 755 "$ADDON_DIR/mar.sh" "$ADDON_DIR/uninstall.sh"

# The first install fills slot a; later installs go through the updater so they can roll back.
if [ -e "$APP_BASE/current" ]; then
  tar -czf "$ROOT/tmp/$NAME-local.tar.gz" -C "$HERE/app" .
  sh "$ADDON_DIR/mar.sh" update "$ROOT/tmp/$NAME-local.tar.gz"
  rm -f "$ROOT/tmp/$NAME-local.tar.gz"
else
  rm -rf "$APP_BASE/slots/a"; mkdir -p "$APP_BASE/slots/a"
  cp -R "$HERE/app/." "$APP_BASE/slots/a/"
  ln -s "$APP_BASE/slots/a" "$APP_BASE/current"
fi

# Marked hook lines, added once.
hook() { # hook <script> <line>
  f="$SCRIPTS/$1"
  [ -f "$f" ] || printf '#!/bin/sh\n' > "$f"
  chmod 755 "$f"
  grep -qF "$BEGIN" "$f" && return 0
  printf '%s\n%s\n%s\n' "$BEGIN" "$2" "$END" >> "$f"
}
hook services-start "sh $ADDON_DIR/mar.sh webui & sh $ADDON_DIR/mar.sh start &"
# The app lives on the USB drive (Entware's /opt), so it can only start once the drive is mounted.
hook post-mount "sh $ADDON_DIR/mar.sh start &"
hook service-event "sh $ADDON_DIR/mar.sh service-event \"\$1\" \"\$2\" &"

# Off by default: write the switch only if it has never been set.
SETTINGS="$ROOT/jffs/addons/custom_settings.txt"
touch "$SETTINGS"
grep -q '^mar_enabled ' "$SETTINGS" || echo "mar_enabled 0" >> "$SETTINGS"
grep -q '^mar_port ' "$SETTINGS" || echo "mar_port 8790" >> "$SETTINGS"

[ "${MAR_SKIP_CHECKS:-0}" = 1 ] || sh "$ADDON_DIR/mar.sh" webui
echo "Installed. The app is switched off. Turn it on from Tools > Material Router on the router's web page."
