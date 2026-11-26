#!/bin/sh
# Removes the Material Asus Router add-on. Keeps the app's data (accounts, history) unless --purge.
ROOT="${MAR_ROOT:-}"
NAME="material-asus-router"
ADDON_DIR="$ROOT/jffs/addons/$NAME"
BEGIN="# >>> material-asus-router (added by its installer; remove with its uninstall.sh)"
END="# <<< material-asus-router"

[ -x "$ADDON_DIR/mar.sh" ] && sh "$ADDON_DIR/mar.sh" stop
[ "${MAR_SKIP_CHECKS:-0}" = 1 ] || sh "$ADDON_DIR/mar.sh" webui-remove 2>/dev/null
for s in services-start post-mount service-event; do
  f="$ROOT/jffs/scripts/$s"
  [ -f "$f" ] || continue
  awk -v b="$BEGIN" -v e="$END" '$0==b{skip=1;next} $0==e{skip=0;next} !skip' "$f" > "$f.new" && mv "$f.new" "$f" && chmod 755 "$f"
done
SETTINGS="$ROOT/jffs/addons/custom_settings.txt"
# grep -v exits 1 when nothing is left, which is still a success here.
if [ -f "$SETTINGS" ]; then { grep -v '^mar_' "$SETTINGS" || true; } > "$SETTINGS.new" && mv "$SETTINGS.new" "$SETTINGS"; fi
rm -rf "$ROOT/opt/share/$NAME" "$ADDON_DIR"
[ "${1:-}" = "--purge" ] && rm -rf "$ROOT/opt/var/$NAME"
echo "Removed. $( [ "${1:-}" = "--purge" ] && echo "Its data was deleted too." || echo "Its data is kept in /opt/var/$NAME; run with --purge to delete it.")"
