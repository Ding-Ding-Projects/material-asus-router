# Closeout prompt

Copy this into a new session to continue the work.

```
Continue Material Asus Router (public repository Ding-Ding-Projects/material-asus-router).

State on 2026-11-25:
- main is current on origin; the full test suite passes (917 tests, one Linux-only test skipped on Windows).
  If a full run stalls after tests/real-controls.test.mjs, make sure nothing else heavy runs at the same time and run again.
- The Docker-hosted app runs on the home network at its own address on port 80 and 8790. The owner updates from
  the App updates screen; by hand: set ROUTER_APP_TAG in the host's .env and run docker compose with all three files.
- Done and verified: kick and ban with the Unkick page, Lock IP, saved routers, uploading the router's key, the router
  add-on package, phone fixes, the Postman collection, README captures, both 3D printer reservations, design canvas
  rounds 4 and the AppUpdate board, the new screens matched to their boards, and the personal wording loader reading
  the shared { schemaVersion, entries } format.

Open:
1. Self-updating is done: the owner-only App updates screen (System), updater/updater.sh and compose.update.yaml,
   running on the live host (compose files: compose.yaml, compose.lan.yaml, compose.update.yaml). A real update to a
   newer build has not happened yet; the next app code change will be the first one to try from the screen.
2. Installing the add-on on the real router needs a USB drive with Entware and Node.js, JFFS custom scripts turned on,
   and the owner's go-ahead.
3. Branch ai/feature/20261125-merlin-addon is kept on the owner's decision; do not delete it. Branches named fix/... on
   origin belong to another session; leave them alone.

Rules: every router write goes through server/changes/engine.mjs; secrets stay in the vault; tests use the pretend
router; only reserved example addresses in code and docs; commit messages in English with a short Cantonese line.
```
