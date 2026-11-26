# Closeout prompt

Copy this into a new session to continue the work.

```
Continue Material Asus Router (public repository Ding-Ding-Projects/material-asus-router).

State on 2026-11-25:
- main is current on origin; the full test suite passes (932 tests: 930 pass, 2 need a Unix shell and are skipped
  on Windows). If a full run stalls after tests/real-controls.test.mjs, make sure nothing else heavy runs at the same
  time and run again.
- The Docker-hosted app runs on the home network at its own address on port 80 and 8790. The owner updates from
  the App updates screen; by hand: set ROUTER_APP_TAG in the host's .env and run docker compose with all three files.
- The first real update through the updater happened on 2026-11-25 (request, pull, restart, health check, pinned
  tag): the live host runs the build of commit a423de96ec6d and answers its health check.
- Done and verified in this session, in tests and in a browser against the demo router:
  1. Staying signed in. Sign-ins are saved in sessions.json on the data volume (a hash of each session cookie,
     never the cookie) and last 90 days from the last use, so a restart or an update no longer signs anyone out.
     People signed in before this build sign in once more, because the old build kept sign-ins only in memory.
  2. Live mode applies every change by itself after a short pause, once per edit, with nothing to review. A change
     that needs the keys waits until the person leaves the field, then asks; a cancelled confirmation leaves the
     change in the bar. The bar follows the Live and Review switch at once.
  3. The four keys are asked only above the household's chosen level (default 1) or above what the household allows
     right now. An owner override and a reboot still take them.
- Done and verified earlier: kick and ban with the Unkick page, Lock IP, saved routers, uploading the router's key, the
  router add-on package, phone fixes, the Postman collection, README captures, both 3D printer reservations, design
  canvas rounds 4 and the AppUpdate board, the new screens matched to their boards, the personal wording loader
  reading the shared { schemaVersion, entries } format, and self-updating.

Open:
1. Not checked on the live host with a real sign-in: the owner signs in once on the new build, and the sign-in
   should then survive the next update. The design canvas has no board yet for the changed pending-changes bar.
2. After a live change a progress dialog still opens and has to be closed; the owner may want that quieter.
3. Installing the add-on on the real router needs a USB drive with Entware and Node.js, JFFS custom scripts turned on,
   and the owner's go-ahead.
4. Branch ai/feature/20261125-merlin-addon is kept on the owner's decision; do not delete it. Branches
   feature/slow-wifi, fix/acknowledge-unset-household and fix/page-scrolls-past-shell on origin belong to another
   session and are not merged; leave them alone. fix/acknowledge-unset-household touches the same household and
   confirmation code as this session's four-key change, so whoever merges it should run the household tests.

Rules: every router write goes through server/changes/engine.mjs; secrets stay in the vault; tests use the pretend
router; only reserved example addresses in code and docs; commit messages in English with a short Cantonese line.
```
