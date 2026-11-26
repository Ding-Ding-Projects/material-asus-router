#!/bin/sh
# The app's updater. It runs next to the app (compose.update.yaml) and is the only part that can
# talk to Docker. The app never gets that access: it only writes a request into the shared
# folder, and this script answers there.
#
#   request.txt   written by the app:  id=<id> action=check|apply by=<name>
#   status.txt    written here: key=value lines (state, step, current, latest, message, ...)
#   history.log   written here: one line per check or update: time|event|detail|by
#   heartbeat.txt written here every few seconds, so the app knows the updater is running
#
# An update pins the exact sha- image of the newest build, restarts only the app's service and
# waits for its health check. If the new version does not answer, the previous tag is put back
# and the previous version started again. The app's data volume is never touched.

set -u
DIR="${UPDATES_DIR:-/updates}"
DEPLOY="${DEPLOY_DIR:-/deploy}"
IMAGE="${IMAGE:-ghcr.io/ding-ding-projects/material-asus-router}"
SERVICE="${TARGET_SERVICE:-asus-router}"
CONTAINER="${TARGET_CONTAINER:-material-asus-router}"
WAIT="${HEALTH_WAIT_SECONDS:-90}"
DOCKER="${DOCKER_BIN:-docker}"
APP_UID="${APP_UID:-1000}"

mkdir -p "$DIR"
chown "$APP_UID" "$DIR" 2>/dev/null || true
chmod 755 "$DIR"

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
clean() { printf '%s' "$1" | tr -cd 'A-Za-z0-9 ,._:/@()-' | cut -c1-200; }

# status key=value lines, replaced as a whole
status() { # status state step message [extra lines]
  tmp="$DIR/status.tmp"
  {
    echo "state=$1"
    echo "step=$2"
    echo "message=$(clean "$3")"
    echo "at=$(now)"
    echo "request=${REQ_ID:-}"
    echo "current=$(running_rev)"
    echo "latest=${LATEST:-}"
    echo "latest_built=${LATEST_BUILT:-}"
  } > "$tmp"
  chmod 644 "$tmp"
  mv -f "$tmp" "$DIR/status.txt"
}

history() { # history event detail by
  printf '%s|%s|%s|%s\n' "$(now)" "$1" "$(clean "$2")" "$(clean "$3")" >> "$DIR/history.log"
  chmod 644 "$DIR/history.log"
  # keep the last 200 lines
  tail -n 200 "$DIR/history.log" > "$DIR/history.tmp" && mv -f "$DIR/history.tmp" "$DIR/history.log"
}

label() { # label <image-or-container> <label>
  "$DOCKER" inspect -f "{{index .Config.Labels \"$2\"}}" "$1" 2>/dev/null
}
running_rev() { label "$CONTAINER" org.opencontainers.image.revision | cut -c1-12; }

env_tag() { sed -n 's/^ROUTER_APP_TAG=//p' "$DEPLOY/.env" | tail -n 1; }
set_tag() { # set_tag <tag>
  if grep -q '^ROUTER_APP_TAG=' "$DEPLOY/.env"; then
    sed "s/^ROUTER_APP_TAG=.*/ROUTER_APP_TAG=$1/" "$DEPLOY/.env" > "$DEPLOY/.env.updating" && cp "$DEPLOY/.env.updating" "$DEPLOY/.env" && rm -f "$DEPLOY/.env.updating"
  else
    echo "ROUTER_APP_TAG=$1" >> "$DEPLOY/.env"
  fi
}

compose() { (cd "$DEPLOY" && "$DOCKER" compose "$@"); }

check() {
  status checking pulling "Looking for a newer version."
  if ! "$DOCKER" pull -q "$IMAGE:latest" >/dev/null 2>&1; then
    status failed pulling "The newest version could not be downloaded. Check the internet connection."
    history check-failed "download failed" "${REQ_BY:-}"
    return 1
  fi
  LATEST=$(label "$IMAGE:latest" org.opencontainers.image.revision | cut -c1-12)
  LATEST_BUILT=$(label "$IMAGE:latest" org.opencontainers.image.created)
  if [ -z "$LATEST" ]; then
    status failed pulling "The newest version has no revision label, so it cannot be pinned."
    return 1
  fi
  return 0
}

health() { "$DOCKER" inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null; }

wait_healthy() {
  n=0
  while [ "$n" -lt "$WAIT" ]; do
    [ "$(health)" = healthy ] && return 0
    sleep 3
    n=$((n + 3))
  done
  return 1
}

apply() {
  check || return 1
  current=$(running_rev)
  if [ "$LATEST" = "$current" ]; then
    status uptodate done "You are up to date."
    history uptodate "sha-$current" "${REQ_BY:-}"
    return 0
  fi
  previous=$(env_tag)
  status updating starting "Starting the new version."
  set_tag "sha-$LATEST"
  if ! compose pull -q "$SERVICE" >/dev/null 2>&1 || ! compose up -d --no-deps "$SERVICE" >/dev/null 2>&1; then
    set_tag "$previous"
    compose up -d --no-deps "$SERVICE" >/dev/null 2>&1
    status rolledback starting "The new version could not be started, so the previous one was put back. Nothing else changed."
    history rolledback "sha-$LATEST did not start" "${REQ_BY:-}"
    return 1
  fi
  status updating waiting "Waiting for it to answer (up to $WAIT seconds)."
  if wait_healthy; then
    status updated done "Now running sha-$LATEST."
    history updated "sha-$LATEST" "${REQ_BY:-}"
    return 0
  fi
  set_tag "$previous"
  compose up -d --no-deps "$SERVICE" >/dev/null 2>&1
  wait_healthy
  status rolledback waiting "The new version did not answer, so the previous one was put back. Nothing else changed."
  history rolledback "sha-$LATEST did not answer" "${REQ_BY:-}"
  return 1
}

handle() {
  line=$(head -n 1 "$DIR/request.txt" 2>/dev/null)
  rm -f "$DIR/request.txt"
  REQ_ID=$(printf '%s' "$line" | sed -n 's/.*id=\([A-Za-z0-9-]*\).*/\1/p')
  action=$(printf '%s' "$line" | sed -n 's/.*action=\([a-z]*\).*/\1/p')
  REQ_BY=$(printf '%s' "$line" | sed -n 's/.*by=\(.*\)$/\1/p')
  case "$action" in
    check)
      if check; then
        if [ "$LATEST" = "$(running_rev)" ]; then status uptodate done "You are up to date."; history checked "up to date" "$REQ_BY"
        else status available done "A newer version is ready: sha-$LATEST."; history checked "sha-$LATEST available" "$REQ_BY"; fi
      fi ;;
    apply) apply ;;
    *) status failed idle "Unknown request." ;;
  esac
}

[ -f "$DIR/status.txt" ] || status idle idle "Ready."
echo "updater: watching $DIR for requests, updating service $SERVICE"
while :; do
  date -u +%s > "$DIR/heartbeat.txt"
  chmod 644 "$DIR/heartbeat.txt"
  [ -f "$DIR/request.txt" ] && handle
  [ "${UPDATER_ONCE:-0}" = 1 ] && exit 0
  sleep "${POLL_SECONDS:-3}"
done
