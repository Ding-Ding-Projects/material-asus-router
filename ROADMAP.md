# Roadmap

A box is ticked only when the work is built, tested and, where it shows something, checked in a
real browser. Unticked items say what is still missing.

## Core

- [x] Sign-in with the app's own accounts; the first account becomes the owner; any number of people signed in at once
- [x] Encrypted vault for router passwords and keys; nothing secret in `state.json`, logs or answers
- [x] SSH connection with host key approval and pinning
- [x] The app's own SSH key, kept fixed; it is never replaced without asking
- [x] Upload a private key you already have for the router (refuses public keys, junk and passphrase-protected keys)
- [x] The connect screen starts from the suggested router address and user name, and the approve step can change the user name and sign-in method
- [x] Save routers by name as Main or Testing and switch between them; a badge shows while a Testing router is in use
- [x] Change engine: preview, router-side safety timer, apply, read back, undo
- [x] Live mode (on by default), local change history, undo and redo, impact levels 1 to 3, four-key confirmation
- [x] Reboot only through the launch sequence
- [x] Start-up failures show the error and a way out instead of a blank page; a loading card shows progress after sign-in

## Devices and sharing

- [x] Device list with rename, block, wake and bulk actions
- [x] Lock IP and Unlock IP in one tap, Lock IPs for a selection
- [x] Kick and ban (pause internet, block name lookups, disconnect from Wi-Fi once), with a log
- [x] Unkick page: the paused device lifts its own pause or ban, without an account
- [x] Slow a device down instead: the Kick sheet points to per-device speed limits, with the QoS impact stated
- [x] Top talkers and device traffic
- [x] AiMesh nodes: list, devices per node, names, backhaul priority, light and restart
- [x] Reserve the owner's second 3D printer's address on the real router (done over SSH once it was online, read back from the router)

## Settings coverage

- [x] Every catalogue entry is a real, typed control proven to read, write and undo on three pretend routers (merlin, stock, and a model of an RT-BE88U on Merlin 3006)
- [x] A setting the router does not have is shown switched off with the reason and never written
- [x] SSH action catalogue, file browser, owner terminal, Entware packages, add-on cards, read-only flash backup, firmware file checker (custom firmware is never flashed)
- [x] One-click modes and the mode builder; canvas editors for the network map, DHCP, rules and schedules
- [x] Wireless diagnostics, ports and hardware, services and cloud, firewall internals, guest network, DSL and captive portal

## Phone

- [x] The page never grows wider than the screen; the tab strip scrolls inside itself
- [x] The bottom bar is one short row
- [x] The fourth confirmation key can be turned by tapping 1, 2 and 3 in order
- [x] Every one of the 125 screens fits at 360 pixels: no screen widens the page and nothing sticks out outside a scrolling area (checked in a browser on 2026-11-25)
- [x] Every control shown at 1440 pixels is also shown at 360 pixels: 5,568 controls on 125 screens, none missing (each screen's opening state, checked in a browser on 2026-11-25)
- [ ] The same check for dialogs and deeper states (Kick and ban, Lock IP with the four-key confirmation, and the Unkick page were driven by hand at phone width)

## Delivery

- [x] Docker-hosted web app: published image, `compose.yaml`, `host.bat` (detached and log modes), setup prompt, LAN address through `compose.lan.yaml`
- [x] Running on the home network at its own address, on port 80 and port 8790, updated to each verified image
- [x] Router add-on package: install, on/off switch on the router's page, Material or Advanced version per browser, A/B updates with automatic rollback, uninstall; tested end to end on Linux
- [ ] Install the add-on on the real router: needs a USB drive, JFFS custom scripts turned on, and the owner's go-ahead
- [ ] Update the app from its own screen with automatic rollback, and optionally every night: the design board (AppUpdate) and the updater service (`updater/`, `compose.update.yaml`) exist; the app's screen, its routes and tests are still missing
- [x] Personal wording loads the shared file format, keeps capital-only differences apart, and a dropped file is handled once
- [x] Desktop app build (installer and portable) in the release workflow
- [x] Install and launch the desktop app on Windows: release v0.1.0-45 installs and opens on its first-run screen (`docs/evidence/`)
- [x] Documentation site with articles in English and Cantonese, and a phone PDF

## Design and records

- [x] Design canvas rounds 1 to 3
- [x] Design canvas round 4: boards for Kick and ban, the Unkick page, Lock IP, Routers, the loading card, the start-up error and the router add-on page
- [x] Match those screens to their round 4 boards: method wording, the Kick and ban log, empty, success and failure states, the Routers results and key choices, the start-up cleared message and the add-on page's saved message (the board text was compared with the app source; a Routers board line about saving on connect was left out because the app saves only when asked)
- [x] README with current captures of the demo at desktop and phone size (`docs/captures/`, provenance in `docs/evidence/`)
- [x] Postman collection for the HTTP API, generated from the source and checked against every live route (`docs/api/`)
