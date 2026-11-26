# Closeout prompt

Copy this into a new session to continue the work.

```
Continue Material Asus Router (public repository Ding-Ding-Projects/material-asus-router).

State on 2026-11-25:
- main is current on origin; the full test suite passes (about 910 tests, one Linux-only test skipped on Windows).
- The Docker-hosted app runs on the home network at its own address, on port 80 and 8790, from image sha-8bc80cc0f1cb.
- Merged and verified: kick and ban with the public Unkick page, Lock IP, saved routers (Main and Testing),
  uploading the router's own SSH key, the router add-on package (tested end to end on Linux), phone fixes
  (bottom bar, touch form of the fourth confirmation key), the Postman collection, README with current captures.
- Desktop release v0.1.0-45 installs and opens on Windows (docs/evidence/).
- All 125 screens fit at 360 px and every control shown at 1440 px is shown at 360 px (opening state of each screen).

Open:
1. Branch ai/feature/20261125-canvas-r4: design canvas boards for Kick and ban, Unkick, Lock IP, Routers,
   the loading card and start-up error, and the router add-on page. It was still being written; review it,
   run node design/canvas/generator/gen.mjs (no errors) and the canvas tests, then merge.
2. Branch ai/feature/20261125-merlin-addon (643bdb9) is an unmerged duplicate of the merged add-on work.
   Its commit message has wording that should not be public. Ask the owner before deleting it.
3. Installing the add-on on the real router needs a USB drive with Entware and Node.js, JFFS custom scripts
   turned on, and the owner's go-ahead.
4. Reserve the second 3D printer's address when it is online.
5. Extend the phone check to dialogs and deeper states.

Rules: every router write goes through server/changes/engine.mjs; secrets stay in the vault; tests use the
pretend router; only reserved example addresses in code and docs; commit messages in English with a short
Cantonese line.
```
