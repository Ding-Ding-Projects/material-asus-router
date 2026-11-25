# Router firmware form

Material Asus Router can also run on the router itself, as part of a custom firmware for the
ASUS RT-BE88U. This folder pins the firmware source; the source lives in its own repository
because it is a large third-party GPL project that is built on Linux.

- Source: `source.json` names the fork, the upstream project, and the exact tag and commit
  (Asuswrt-Merlin 3006.102.7_2) the build starts from.
- Status: in progress. The build, the size budget and the dual-image fallback are still being
  worked out. No firmware image has been published.

Planned behaviour:

- The app is off by default. One switch on the router's own web page turns it on, and from then
  on every feature lives in the app, not in the router's stock pages.
- Two choices on that page: the Material version (the full modern app) and the Advanced version
  (every control, the action catalogue and the terminal). The choice is remembered in each browser.
- The firmware is flashed into the router's inactive firmware slot, and the router falls back to
  the previous firmware if its own networking is not healthy after the update.
- The app updates from this repository's releases without reflashing, into a spare app slot,
  and switches over only after a health check.
- You flash the firmware yourself through the router's firmware page. Read the recovery steps
  before you do.
