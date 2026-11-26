# Updater

The updater lets the owner update the app from its **App updates** screen, or every night. It runs
next to the app (`compose.update.yaml`) and is the only part that can talk to Docker; the app only
writes a request into the shared updates folder and reads the answer.

An update pulls the newest build, pins its exact `sha-` image in `.env`, restarts only the app's
service and waits for its health check (up to 90 seconds). If the new version does not answer, the
previous tag is put back and the previous version started again. The app's data volume is never
touched.

Start it with:

```
docker compose -f compose.yaml -f compose.lan.yaml -f compose.update.yaml up -d
```

Files in the shared folder: `request.txt` (from the app), `status.txt`, `history.log` and
`heartbeat.txt` (from the updater). `tests/features/app-update.test.mjs` runs `updater.sh` against a
stand-in for the docker command, including a version that does not answer.
