# Handoff

State of the project for whoever picks it up next. See `ROADMAP.md` for the full checklist.

## Where things are

- Main branch: every feature lane from the third wave is merged, plus the router add-on, Kick and
  ban, Lock IP, router access (key upload and saved routers) and the phone fixes.
- Tests: `npm test` runs about 910 tests against the pretend router. One test, the add-on's end to
  end install, needs a Unix shell with real symbolic links and is skipped on Windows; it passes on
  Linux in a `node:24-bookworm-slim` container.
- The full test run takes about three minutes. If the run seems to hang, check that nothing else
  heavy runs at the same time; the control check (`tests/real-controls.test.mjs`) is the long one.

## Decisions to keep

- The router-hosted form is an Asuswrt-Merlin add-on, not a custom firmware (`firmware/README.md`).
- Kick and ban rules live in the app's own firewall chains, `MAR_PAUSE` and `MAR_NAMES`, matched
  by MAC address. The Unkick page is public on purpose: it may only lift a pause on the device the
  request comes from, and lifting needs the page's own header.
- The app's own preferences are never written to the router; they are app preferences.
- The changelog merges by union (`.gitattributes`), because every branch adds lines at one place.

## Waiting on the owner

- The add-on on the real router needs a USB drive with Entware and Node.js, JFFS custom scripts
  turned on (a router reboot), and the owner's go-ahead.
- The second 3D printer's address reservation waits until that printer is online.

## Next steps

1. Match the new screens (Kick and ban, Unkick, Lock IP, Routers, loading, start-up error and the
   router add-on page) to their design canvas boards, which were added in canvas round 4.
2. Extend the phone check to dialogs and deeper states (the opening state of all 125 screens passes).
3. Install the add-on on the real router once the owner has a USB drive with Entware and Node.js.
