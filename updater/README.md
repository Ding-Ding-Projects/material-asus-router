# Updater (in progress)

**Unfinished.** This folder and `compose.update.yaml` hold the first part of self-updating: the
updater service that pulls the newest build, restarts only the app's service, waits for its health
check and puts the previous version back if the new one does not answer. Still missing:

- The app's owner-only App updates screen and its server routes, which write `request.txt` and read
  `status.txt` and `history.log` in the shared updates folder (design: the `AppUpdate` canvas board).
- The night-time automatic update.
- Tests for `updater.sh` (run on Linux with a stand-in for the docker command).

Nothing uses these files yet, and the live deployment does not include `compose.update.yaml`.
