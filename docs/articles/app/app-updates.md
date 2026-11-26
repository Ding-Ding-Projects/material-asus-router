---
title: Update the app
category: app
order: 20
summary: Update the Docker-hosted app from its own screen, or every night, with an automatic roll back if the new version does not answer.
status: in-progress
related: delivery/docker-image, delivery/releases
---

The **App updates** screen (System) shows the version that is running and whether a newer build is
ready. Only the owner can update.

- **Check for updates** looks for the newest build and changes nothing.
- **Update now** downloads it, starts it and waits up to 90 seconds for it to answer. The steps tick
  off on the screen. If it does not answer, the previous version is put back by itself and the
  screen says so.
- **Update automatically every night** does the same at 02:00, 03:00 or 04:00 your time, and only
  switches when the new version passes its health check.

Your accounts, router settings and change history are kept; only the app is replaced.

## Set it up

Self-updating needs the small updater service next to the app. It is the only part that can talk
to Docker, has no network of its own and restarts only the app's service:

```
docker compose -f compose.yaml -f compose.lan.yaml -f compose.update.yaml up -d
```

Without it, update by hand: set the new image tag in `.env`, then pull and restart.
