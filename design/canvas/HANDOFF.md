# Material Asus Router: design handoff

This folder holds the design canvas for Material Asus Router, a self-hosted web app and Windows desktop app that manages an Asus router (stock ASUS or Asuswrt-Merlin) over SSH. The canvas project is in `design/canvas/project`. Every board is one whole HTML file; `theme.css` is the shared expressive Material 3 theme; `Rail.dc.html` and `TopBar.dc.html` are the shared shell that every desktop board imports.

Demo data throughout: an RT-AX86U at 198.51.100.1 on the documentation network 198.51.100.0/24, outside addresses in 203.0.113.0/24 and 192.0.2.0/24, people named Pat and Alex.

## Tweaks carried by every board

Every board, including the two shell components, declares the same Tweaks with the same names and defaults: accent (colour, default #4f5bd5, five swatches), dark (boolean, default false), motion (calm, standard, expressive; default expressive), firmware (merlin, stock; default merlin), role (owner, operator, viewer; default owner), lang (en, yue, both; default en). Boards with stages add `stage` (loading, empty, ready, success, failure). The shell components add their own content props (page, pending, title, tabs, active).

What each Tweak does on every board:

- **accent** re-tones every colour role; all roles are derived from the one accent in `theme.css`.
- **dark** flips every surface and text role.
- **motion** calm stills every animation and transition, standard keeps normal motion and removes the dramatic set, expressive plays everything. The operating system reduced-motion setting also stills everything. The resting frame is the designed frame, so a still board reads on its own.
- **firmware** changes the firmware name in the rail, top bar and hero, hides or locks Merlin-only areas and shows the reason on stock.
- **role** viewer dims and disables every control that would change the router and shows a read-only strip; operator locks owner-only actions with the reason; owner sees everything.
- **lang** switches every string between English, Hong Kong Cantonese and both side by side.

## Motion system

**Normal motion, on every board:** staggered card entrances (`.rise`), hover lift on cards, press squash and shape morph on buttons, chips and steppers, switch thumb spring, meter bars growing from the left, focus rings, navigation rail hover shift, bottom sheets springing from the edge on phones.

**Dramatic motion, only where it carries meaning:** listed per board below. The dramatic set uses the classes `dr`, `u-spin`, `u-float`, `u-rip`, `u-pop`, `u-conf`, `u-shake`, `u-count`, `u-draw`, `u-ringv` and `u-needle`.

## Control library (theme.css, classes starting with u-)

Switch, segmented buttons, select with a description line, thick slider with value bubble, stepper, four-part IPv4 picker, prefix stepper with a network and host bar, port picker with presets, device picker (name, MAC, address), paintable weekly schedule grid (one toggle per hour), two-handle address-range bar with reservation dots, password field with reveal and strength meter, toggle chips, file drop zone, split button, sticky action dock, extended FAB. Graphics: gradient area chart, bar chart, horizontal bars, ring, gauge with needle, wavy progress, step pipeline, sparkline, sample QR pattern, confetti.

In the generated boards every one of these controls is wired to board state, so it can be operated on the canvas.

## Pages and boards

### Setup and onboarding (page id `setup`)

**First run: owner, router, host key, firmware, language** (`Setup.dc.html`, 1440 wide, fills, interactive)

- Shows: Setup and onboarding wizard. Step 1 creates the owner (the first account becomes the owner, no setup code). Step 2 connects with a generated app key (default) or the router password, typed only here and stored encrypted. Step 3 shows the host key fingerprint to approve once. Later steps detect stock or Merlin firmware and pick language and theme. Try: Next and Back, App key or Password, the reveal button, Tweaks > lang and firmware. Stands for the app's first-run screens. Unbuilt in the app: firmware detection summary and the language and theme step.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Step progress and the detection moment animate; panels stagger in.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Firmware detection summary and the language and theme step are design only; owner, connect and host key exist.

### Overview and notifications (page id `overview`)

**Overview** (`Main.dc.html`, 1440 wide, fills, interactive)

- Shows: Overview: router health at a glance. Model, firmware (stock or Merlin, detected), uptime, latency, a wavy health bar, quick actions that queue into pending changes, a live traffic chart with range buttons, band and mesh tiles and a recent-changes timeline with undo and bulk select. Try: the quick action buttons (they join the pending count in the rail), the range buttons, Undo on a change, Tweaks > firmware, lang, dark, role. Unbuilt in the app: the live chart data source and quick actions.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Hero shapes and the wavy health bar move; the live dot pulses; cards stagger in.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Live traffic chart source, quick actions and bulk undo are design only.

**Notifications centre and toasts** (`Notifications.dc.html`, 1440 wide, fills, interactive)

- Shows: Notifications centre and toasts. Toasts slide in without stealing focus, then settle into the centre where they can be filtered, searched, snoozed and followed to the page that raised them. Try: the toast preview stage buttons, the toast setting switches, the filter chips, the search box with its regex button. Unbuilt in the app: the centre; the app has simple toasts.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Toasts slide in and settle; unread badges pulse.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Notification centre, snooze and per-kind settings are design only.

### Devices (page id `devices`)

**Devices** (`Devices.dc.html`, 1440 wide, fills, interactive)

- Shows: Devices: who is connected, by name, with signal and band. Row actions: rename, reserve address, block internet, wake. Bulk select runs block and reserve on many at once. Viewers see the list without the actions. Try: row menus, the select boxes and the bulk bar, the filter chips, role viewer. Stands for the app's devices screen. Unbuilt in the app: bulk actions and the signal history.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Cards stagger in; live dots pulse.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Bulk actions and signal history are design only.

### Wi-Fi and AiMesh (page id `wifi`)

**Wi-Fi** (`WiFi.dc.html`, 1440 wide, fills, interactive)

- Shows: Wi-Fi: one card per band plus guest networks. Every edit joins the pending bar at the bottom; nothing reaches the router until Preview and Apply. Try: flip a radio or the guest switch and watch the pending count, the transmit power slider, the QR share on the guest card. Stands for the band settings in the catalogue (radio, name, hidden, security, password, channel, width, power, guest). Unbuilt in the app: the QR share.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Band cards stagger in; the pending dock rises.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Guest QR share is design only; the band settings exist.

**AiMesh** (`Mesh.dc.html`, 1440 wide, fills, interactive)

- Shows: AiMesh: how every node connects, how strong each backhaul is and which devices sit on which node, with a topology map and clients per node. A summary of USB storage sits at the bottom; the full storage board is on the Storage page. Try: Tweaks > firmware and role, node cards. Unbuilt in the app: topology map and node actions.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Topology links and node badges animate in.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Topology map, backhaul strength and node actions are design only.

### Internet, local network, ports, traffic priority (page id `network`)

**Internet, local network, port forwarding** (`Network.dc.html`, 1440 wide, fills, interactive)

- Shows: Internet (connection type, DNS, dynamic DNS), local network (router address, DHCP range, reservations) and port forwarding as a readable table, switched with the view buttons at the top. Changing the router address is a network-affecting change and runs under the connection-loss guard. Try: the view buttons, connection type buttons, Run speed test. The newer Addresses and ports board on this page replaces the typed address boxes here with pickers.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Hero shapes, wavy speed bar and live values animate.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Speed test and latency list are design only; the internet and local network settings exist.

**Addresses and ports** (`Lan.dc.html`, 1440 wide, fills, interactive)

- Shows: Local network, DHCP and port forwarding rebuilt with real pickers instead of typed boxes. Try: the four-part router address (last part is editable), the prefix stepper (the network and host bar resizes), both handles on the address-range bar, the lease slider, port presets (they fill the port box), the device pickers, protocol buttons. Stands for lan.ip, lan.mask, lan.domain, dhcp.* and the forwarding list. Changing the router address runs under the connection-loss guard. Unbuilt in the app: the range bar, subnet visual and presets; the app has typed IPv4 fields today.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Hero address map: the router node ripples, the pool bar grows, shapes rotate.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Range bar, subnet visual, port presets and reservation dots are design only.

**Traffic priority** (`Qos.dc.html`, 1440 wide, fills, interactive)

- Shows: Traffic priority (QoS) with per-device traffic. The hero chart splits live download by app type; the ladder ranks app types with real up and down buttons; each device row carries a speed-limit stepper and a priority chip. Try: the QoS switch, the method select (its description changes), both speed sliders, the ladder arrows, firmware (the Merlin-only fair-queue card locks on stock), role viewer. Stands for the qos.enabled, qos.type, qos.up and qos.down catalogue settings. Unbuilt in the app: the ladder, per-device limits and the live split chart.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Hero area chart draws in and its fill fades up; the live ring fills; decorative shapes rotate slowly.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Priority ladder, per-device limits, live split chart and app-type detection are design only; the app has the four QoS catalogue settings.

### Firewall, parental controls, VPN (page id `security`)

**Firewall, parental controls, VPN: overview** (`Security.dc.html`, 1440 wide, fills, interactive)

- Shows: One-board overview of firewall switches, parental controls and the VPN servers (OpenVPN and WireGuard). Models without WireGuard show the control disabled with the reason, never hidden. Each area now has its own deeper board on this page: Firewall, Parental controls and VPN. Try: the switches and Tweaks > firmware and role.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Cards stagger in.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: See the three deeper boards for what is design only.

**Firewall** (`Firewall.dc.html`, 1440 wide, fills, interactive)

- Shows: Firewall with DMZ, UPnP, address and keyword filters. The hero shield counts blocked attempts over 24 hours. Try: each switch, the DMZ device picker, the UPnP lease table switches, filter chips, the protection level buttons. Stands for fw.enabled, fw.ping, fw.dos and fw.ipv6 in the catalogue. Unbuilt in the app: blocked-attempt chart, DMZ, UPnP table and filters.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Shield badge pops in and ripples; the blocked-attempts bars grow in sequence.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Blocked-attempt chart, DMZ, UPnP lease table, keyword and address filters are design only.

**Parental controls** (`Parental.dc.html`, 1440 wide, fills, interactive)

- Shows: Parental controls with a paintable weekly schedule. Every hour cell is a real toggle (168 of them); day chips fill a whole day. Try: paint hours on the grid, the daily limit slider, bedtime steppers, the Pause internet button state, content chips, the profile buttons. Stands for parental.enabled (MULTIFILTER_ALL) and the per-device schedule lists. Unbuilt in the app: profiles, daily limits, usage chart, bonus time.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Hero ring shows today's screen time filling; the pause badge ripples.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Profiles, daily limits, usage history and bonus time are design only; the app has the master switch.

**VPN** (`Vpn.dc.html`, 1440 wide, fills, interactive)

- Shows: VPN servers: OpenVPN and WireGuard side by side, peers with pairing QR, and the Merlin VPN client routing card (locked with a reason on stock). Try: both server switches, port presets, UDP or TCP, the peer switches, the tunnel segmented view, firmware stock, role operator. Stands for vpn.openvpn, vpn.openvpn.port, vpn.openvpn.proto, vpn.wireguard and vpn.wireguard.port; models without WireGuard show it disabled with the reason. Unbuilt in the app: peer list, QR pairing, traffic chart, VPN client routing.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Hero tunnel: two endpoints ripple and the tunnel line draws between them.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Peer management, QR pairing, per-peer traffic and VPN Director style routing are design only.

### USB and storage (page id `storage`)

**USB and storage** (`Storage.dc.html`, 1440 wide, fills, interactive)

- Shows: USB and storage with stages. Try Tweaks > stage: loading (drive being read), empty (nothing plugged in), ready (the full page), success (safely removed) and failure (drive not readable). On ready: sharing switches, permission buttons per folder, the media server select, Time Machine quota slider, the safe-remove button. Stands for usb.samba and usb.ftp, which need a USB drive (the requires flag); with no drive the controls show disabled with the reason. Unbuilt in the app: folder permissions, drive health, media server and Time Machine.
- Tweaks: the six shared Tweaks plus `stage` (loading, empty, ready, success, failure).
- Dramatic motion: Usage ring fills; partition bar grows; the empty stage plug floats; success badge pops, failure card shakes.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Folder permissions, health checks, media server, Time Machine and safe-remove progress are design only.

### Logs, network tools, router tools, scheduled jobs (page id `tools`)

**Network tools and live log** (`Tools.dc.html`, 1440 wide, fills, interactive)

- Shows: Ping, traceroute and name lookup run on the router itself. The live log has plain search plus the adjacent regex builder button. Scheduled jobs and USB summaries sit below. Try: the tool buttons and the log filter. Stands for the app's tools and logs screens. Unbuilt in the app: live log streaming and the full regex builder (see the Regex builder board).
- Tweaks: the six shared Tweaks.
- Dramatic motion: Log lines arrive; the running tool shows progress.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Live log streaming is design only; ping, traceroute and lookup exist.

**Speed lab** (`SpeedLab.dc.html`, 1440 wide, fills, interactive)

- Shows: Router tools, part one: speed test, latency monitor, DNS benchmark, port checker and Wi-Fi channel analyser. Tweaks > stage drives the speed test: loading (test running, needle sweeping), empty (never run), ready (last result), success (new record) and failure (no route). Try: the band buttons on the analyser (bars swap), port presets, the target chips, the interval stepper. Runs on the router itself, like the app's ping, traceroute and name lookup. Unbuilt in the app: all five tools on this board.
- Tweaks: the six shared Tweaks plus `stage` (loading, empty, ready, success, failure).
- Dramatic motion: Gauge needle sweeps to the result with overshoot; latency line draws; channel bars grow in sequence; the running stage shows wavy progress.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Speed test, latency monitor, DNS benchmark, port checker and channel analyser are design only.

**Router utilities** (`Utilities.dc.html`, 1440 wide, fills, interactive)

- Shows: Router tools, part two: settings snapshots with a side-by-side diff, Wi-Fi QR share, Wake-on-LAN schedules, subnet calculator and per-device traffic. Try: the two snapshot selects (their descriptions change), the network select and Hide password on the QR card, the wake schedule day chips and hour stepper, the address parts and prefix stepper in the calculator (the network bar resizes), the traffic range buttons. Stands for the app's backups, the Wake action on devices and the read-only device list. Unbuilt in the app: snapshot diff, QR share, wake schedules, calculator, per-device history.
- Tweaks: the six shared Tweaks.
- Dramatic motion: QR card pops in on a rotating scalloped plate; traffic bars grow; the diff lines fade in.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Snapshot diff, QR share, wake schedules, subnet calculator and per-device history are design only.

**Scheduled jobs** (`Jobs.dc.html`, 1440 wide, fills, interactive)

- Shows: Scheduled jobs. The app lists the router's cron table as raw text; this board turns it into a timeline of the next 24 hours, a switch per job and a builder that never asks for cron syntax. Try: frequency buttons (the day chips and time steppers react to state), the action select, job switches, firmware stock (custom script jobs lock), role viewer. The plain-words sentence and the cron line under the builder show what will be written. Unbuilt in the app: the builder, the timeline, pause and run-now.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Timeline markers pop in along the 24 hour track and the next job ripples.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Job builder, 24 hour timeline, pause and run-now are design only; the app shows the cron table read-only.

### Firmware, system, maintenance, backup, advanced, Merlin (page id `router`)

**Firmware** (`Firmware.dc.html`, 1440 wide, fills, interactive)

- Shows: Firmware with every stage. Tweaks > stage: loading (flashing, pipeline at Write with wavy progress), empty (already up to date), ready (update available with what changed), success (new version running) and failure (file did not verify, nothing written). Try: Install now walks to the flashing stage, release track buttons, the automatic-install switch and hour stepper, firmware stock (versions and track names change). The safety checklist mirrors the app's rule that a backup is taken first and the two-key confirmation is required. Unbuilt in the app: update check, download, verify and flash.
- Tweaks: the six shared Tweaks plus `stage` (loading, empty, ready, success, failure).
- Dramatic motion: Pipeline connector flows between steps and the active step pulses; wavy progress runs; success badge pops with confetti; failure shakes once.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: The whole firmware flow is design only; the app reads the running version.

**System and maintenance** (`System.dc.html`, 1440 wide, fills, interactive)

- Shows: System settings and the Maintenance area with the two-key super confirmation. Try: the key switches on the factory reset card (first key is your authenticator, second key is the hold phrase; both must be on before the red button wakes), the restart schedule day chips, SSH access buttons and port presets, the time zone select, LED and sleep switches, role operator (destructive actions lock with the reason). Stands for the catalogue risk level destructive, which the app guards with a two-key confirmation. Unbuilt in the app: scheduled restart, LED and sleep controls, SSH hardening choices.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Hero uptime ring fills; when both keys are on, the key cards morph and turn green.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Scheduled restart, LED and sleep controls, time settings and access hardening are design only; the two-key flow exists for destructive actions.

**Backup and restore** (`Backup.dc.html`, 1440 wide, fills, interactive)

- Shows: Backup and restore with stages. Tweaks > stage: loading (restore running through its pipeline), empty (no backups yet), ready (list, drop zone, schedule), success (restored and verified) and failure (wrong password, nothing changed). Try: the drop zone hover, the keep-count stepper, where-to-keep buttons, the encryption switch and password reveal, what-to-include chips. Restore is a destructive action: it shows the diff first and needs the two-key confirmation. Stands for the app's backup domain. Unbuilt in the app: scheduled backups, encryption, partial restore.
- Tweaks: the six shared Tweaks plus `stage` (loading, empty, ready, success, failure).
- Dramatic motion: Restore pipeline flows; the vault badge floats on the empty stage; success pops with confetti; failure shakes.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Scheduled and encrypted backups, partial restore and off-router copies are design only.

**Advanced table and Merlin extras** (`Advanced.dc.html`, 1440 wide, fills, interactive)

- Shows: Advanced: every remaining router value in a searchable table, catalogue label first and raw key second, secrets masked, each edit through a preview. Merlin extras (custom scripts, add-ons, Entware) show locked with the reason on stock firmware: flip Tweaks > firmware. Try: the search, a row edit sheet, bulk select. Stands for the app's advanced screen and the Merlin domain.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Rows stagger in; the edit sheet springs up.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Merlin add-on management is design only; the advanced table exists.

### Change history, write stages, takeovers, exports (page id `changes`)

**Change history, preview, guard, applied, reverted, failed** (`Changes.dc.html`, 1440 wide, fills, interactive)

- Shows: The write path. Preview lists every change in plain words with the old and new value. Network changes arm a guard on the router that puts the old values back unless the app can still reach it. History keeps every change with Undo. Try the stage buttons: preview, guard countdown, applied, reverted, failed; the guard length buttons; Undo on a history row. Stands for the app's preview, guard and history.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Guard countdown, the pipeline and the applied, reverted and failed moments animate.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Bulk undo and the split apply menu are design only; preview, guard and undo exist.

**Install and update takeovers** (`Takeover.dc.html`, 1440 wide, fills, interactive)

- Shows: The full-screen takeovers that play on every install, update, setup or deployment, whoever started it. Tweaks > stage: success (celebration: what was installed, where, exit code, time taken; leaves on click, Escape or after eight seconds), failure (alarm: exact command with secrets masked, exit code, last real output lines, recovery actions; stays until dismissed), loading (install running), ready (the quiet notification used when takeovers are switched off) and empty (nothing recent). Try the motion Tweak: calm keeps the same facts with no movement. Unbuilt in the app: both takeovers; the app has toasts only.
- Tweaks: the six shared Tweaks plus `stage` (loading, empty, ready, success, failure).
- Dramatic motion: Success: scalloped badge pops with overshoot, confetti bursts in a loop, shapes rotate. Failure: the panel shakes once, the alarm badge ripples. Loading: wavy progress and a flowing pipeline.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Both takeovers, the keep-until-dismissed rule and the setting that swaps them for notifications are design only.

**Exports, bulk actions, history replay** (`Records.dc.html`, 1440 wide, fills, interactive)

- Shows: Records and exports: export settings, devices and logs in six formats, export options as switches, history replay, a changelog summary, an update-coming-soon summary and the offline manual entry. The deeper boards are Updates (changelog and update coming soon) and Help and docs. Try: the format chips and option switches. Unbuilt in the app: exports and replay.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Cards stagger in; export progress animates.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Exports in six formats and history replay are design only.

### Settings, tabs, appearance, language, modes, locks, regex, updates (page id `app`)

**Settings and command palette** (`Settings.dc.html`, 1440 wide, fills, interactive)

- Shows: App settings with a search that finds a setting wherever it lives; every control has its own info button and reset. The command palette reaches every page and action. Try: the search field, a reset button, Tweaks > lang and role. Unbuilt in the app: most of the settings catalogue for the app itself.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Search results animate in.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Most app settings and the command palette are design only.

**New tab catalog and workspace tabs** (`Tabs.dc.html`, 1440 wide, fills, interactive)

- Shows: Workspace tabs and the New tab catalog: every page, setting, tool and action is listed with its icon, searchable by plain text or with the adjacent regex builder. Open every tab, close what you do not need, bring it back in one click; router workspaces keep one tab per router. Try: the tab strip close buttons, the plus button, the catalog search. Unbuilt in the app: the catalog; the app has simple tabs.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Tabs slide and reorder; the catalog dialog springs open.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: New tab catalog, workspaces and tab management are design only.

**Appearance editor, infinite colour picker, animation editor** (`Appearance.dc.html`, 1440 wide, fills, interactive)

- Shows: Appearance editor: restyle any element (corner radius, size, spacing), mix any colour in the infinite colour picker, redraw the logo and tune every animation in the animation and transition editor (per element kind: on or off, duration, delay, stagger, easing, distance), with a live preview and JSON import and export. Reduced motion always wins and the editor says so. Try: every slider; they drive the live preview.
- Tweaks: the six shared Tweaks.
- Dramatic motion: The live preview replays the motion being edited.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: The whole editor is design only; the app has theme, accent and motion choices.

**Language modes, funny levels, personal vocabulary, narrator, sounds** (`Language.dc.html`, 1440 wide, fills, interactive)

- Shows: Language modes (English, Cantonese, both), per-language funny-level sliders, the personal vocabulary drop zone with its applied, refused and too-large results, school mode dialogs, attention modes, narrator and sounds. Try: the sliders, the mode buttons, the drop zone result buttons. The deeper School and focus modes board covers school and ADHD modes. Unbuilt in the app: funny levels, vocabulary file, narrator and sounds.
- Tweaks: the six shared Tweaks.
- Dramatic motion: The vocabulary drop celebrates on success and refuses clearly on failure.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Funny levels, vocabulary file, narrator and sounds are design only; language switching exists.

**School and ADHD modes** (`Focus.dc.html`, 1440 wide, fills, interactive)

- Shows: School mode and ADHD mode. Try: the two master switches (the preview on the right of each card changes state), the focus-length slider, one-thing-at-a-time and low-stimulation switches, the break reminder stepper, the school timetable grid (paint the hours when school mode switches itself on), the allowed-areas chips. School mode suspends the personal vocabulary file and funny wording, hides risky actions and locks the toolbox. ADHD mode shows one task at a time, keeps the next step pinned and replaces takeovers with quiet notifications when low stimulation is on. Unbuilt in the app: both modes.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Hero focus ring counts the current session; the "one thing" card pops in; everything else stays deliberately quiet.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: School mode, ADHD mode, timetable activation and the focus session ring are design only.

**Locks, unlock ladder, support tickets, authenticator with QR pairing** (`Locks.dc.html`, 1440 wide, fills, interactive)

- Shows: Element locks that stop slips, the unlock ladder that asks for more as risk grows, a reboot that needs two different people, the authenticator with QR pairing and the recovery desk with support tickets. Try: lock buttons, the ladder steps, the reboot dialog, the pairing card. The two-key factory reset is on the System and maintenance board.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Locks snap shut; ladder steps light up in order.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Element locks, ladder, tickets and authenticator pairing are design only.

**Regex builder** (`Regex.dc.html`, 1440 wide, fills, interactive)

- Shows: The full regex builder that sits beside every search box. Try: the mode buttons (Build, Explain, Replace, Library, Convert, Debug swap the middle panel), flag chips, the engine select (its description names the exact engine and version), the timeout slider, token buttons, the Use in search split button. Matches are highlighted in the sample log with capture groups in a second colour, and the match table lists groups. Each search owns its own pattern, flags and mode. Honest gaps are listed in the last card: the builder is not at full parity yet. Unbuilt in the app: all of it beyond a plain search box.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Match highlights fade in; the explain tree rows stagger in; the pattern tokens lift on hover.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: The whole builder is design only. Parity with the reference tool is tracked as an inventory; several capabilities are marked unavailable in the gaps card.

**Changelog and update coming soon** (`Updates.dc.html`, 1440 wide, fills, interactive)

- Shows: Update coming soon plus the changelog. Tweaks > stage: loading (a newer build is being made: build number, every stage with its own state, 24 hour start, elapsed time, a labelled estimate, what it will contain; nothing can be installed yet), ready (published: the ordinary update offer), empty (you are on the newest build), success (updated, new version on the front screen) and failure (the build broke at a named stage; nothing to install). Try: the channel buttons, the notify switch, the changelog filter chips. Nothing here installs anything or invents progress. Unbuilt in the app: all of it; the top bar pill is a placeholder.
- Tweaks: the six shared Tweaks plus `stage` (loading, empty, ready, success, failure).
- Dramatic motion: Build pipeline flows towards the active stage, which pulses; wavy progress shows the measured part only; success pops with confetti.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Build status feed, update offer, self-update and changelog are design only.

### Toolbox and server manager (page id `toolbox`)

**Toolbox: converter, Base64, quicktype, Ollama, virtual disks, editor, drawing** (`Toolbox.dc.html`, 1440 wide, fills, interactive)

- Shows: Eight tools that run locally with no uploads: file converter, Base64, quicktype studio, notes, drawing and capture markup, external editor hand-off, the Ollama suite and the virtual disk manager. Try: the tool tabs and each tool's controls. Unbuilt in the app: all of the toolbox.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Tool panels cross-fade; conversions show progress.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: The whole toolbox is design only.

**Minecraft server manager and world generator** (`ServerManager.dc.html`, 1440 wide, fills, interactive)

- Shows: Create a Java or Bedrock server on this PC, in Docker, or on a NAS over SSH; pick any version, add plugins, watch the console and players, and pre-generate a world in the world generator. Try: the target and version controls, console buttons. Unbuilt in the app: all of it.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Server start-up and world generation progress animate.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: The server manager and world generator are design only.

### Deploy assistant and instances (page id `deploy`)

**Deploy assistant and instance manager** (`Deploy.dc.html`, 1440 wide, fills, interactive)

- Shows: Deploy assistant (desktop companion): one-click Docker hosting here or over SSH, VirtualBox, VMware, USB and Raspberry Pi flashing, with pre-flight checks, what gets deployed, the removable drive list (never preselected, system disks never offered) and the instance manager (start, stop, open, copy link, logs, update, duplicate, remove). Try: target cards and instance actions. Design only for now; the companion is not built.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Deploy progress and the verified-link moment animate.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: The deploy assistant and instance manager are design only.

### Documentation website and offline docs (page id `docs`)

**Documentation website landing** (`Docs.dc.html`, 1440 wide, fills, interactive)

- Shows: The documentation website landing: what the app is, install in one command, task-led entry points and capture placeholders that are replaced by real captures after each release build. The in-app offline reader is the Help and docs board beside it. Try: the system buttons on the install card.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Hero and feature tiles stagger in.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Real captures are pending a built release; the generated documentation pages exist.

**Offline docs** (`Help.dc.html`, 1440 wide, fills, interactive)

- Shows: The in-app offline documentation reader. It leads with tasks, not file names. Try: the task tiles, the reading-size slider, the interactive guard explainer (the three step buttons change the diagram and the explanation), article progress chips, the regex button beside the search. Every article and the wiki are bundled, so this works with no internet; the documentation website and the phone-size PDF are generated from the same source. Unbuilt in the app: the reader; the documentation website exists as generated pages.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Explainer diagram: the countdown ring and the flowing pipeline react to the step you pick; task tiles stagger in.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: In-app reader, progress memory and the interactive explainers are design only.

### Phone boards: where every desktop feature lands (page id `phone`)

**Phone: overview** (`Phone.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Phone width (390 by 844, fixed root). The rail becomes a bottom bar and an All areas sheet, cards stack, quick actions stay one thumb away. Nothing reachable on desktop is removed. Try: the bottom bar and the All areas button.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Hero shapes move; cards stagger in.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Phone layout is design only.

**Phone: Wi-Fi and change sheet** (`PhoneWifi.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Wi-Fi on a phone: band cards stack and pending changes become a bottom sheet with the preview of the write and the guard countdown. Try: a radio switch, then the pending sheet.
- Tweaks: the six shared Tweaks.
- Dramatic motion: The pending sheet springs up; the guard counts down.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Phone layout is design only.

**Phone: where everything lands** (`PhoneNav.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Phone map of the whole app. The desktop rail has 30 destinations; on a phone the five busiest sit in the bottom bar and every other one is a tile here, grouped the same way. Nothing is removed: each tile names where the desktop feature lands. Try: the group chips filter the tiles (state), firmware stock (Merlin extras tile shows its lock), role viewer. The search field opens the same command palette as desktop. Unbuilt in the app: the tile catalog; the app's phone layout uses the rail as a drawer.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Tiles stagger in; pressed tiles squash and round off.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Tile catalog and its grouping are design only.

**Phone: devices and device sheet** (`PhoneDevices.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Devices on a phone. The desktop table becomes cards; row actions move into a bottom sheet (open by default here for Pat-Laptop). Bulk select becomes a long-press mode shown by the chip row. Try: the filter buttons, the sheet switches (Block internet, Reserve address), the priority buttons, the sheet close button, role viewer (write controls dim). An arriving device ripples at the top of the list. Stands for the app's devices screen and its rename, reserve, block and wake actions.
- Tweaks: the six shared Tweaks.
- Dramatic motion: New-device arrival ripples; the bottom sheet springs up from the edge.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Bottom sheet, long-press bulk mode and arrival highlight are design only.

**Phone: preview, guard and result** (`PhoneGuard.dc.html`, 390 by 844, fixed root, interactive)

- Shows: The write path on a phone, one stage per screen. Tweaks > stage: ready (preview of pending changes with old and new values), loading (guard countdown: a 90 second ring that empties while the app tries to reach the router at its new address), success (kept), failure (the router refused the write; nothing changed) and empty (the guard ran out and the router put the old values back by itself; no pending changes). Try: Apply walks to the countdown, Keep and Revert end it, the guard length buttons. Same rules as desktop: network changes always run under the guard. Unbuilt in the app: the phone layout of this flow.
- Tweaks: the six shared Tweaks plus `stage` (loading, empty, ready, success, failure).
- Dramatic motion: Guard ring drains in real time and ripples; the result badge pops (kept) or the panel shakes (refused).
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Phone layout of preview and guard; the guard itself exists in the app.

**Phone: tools and toolbox** (`PhoneTools.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Where the desktop tool boards land on a phone: the speed gauge leads, router tools are one scrolling row of large tiles each, and the toolbox (file converter, Base64, quicktype studio, Ollama, virtual disks, Minecraft server manager and world generator, external editor, drawing) is a tile grid. Try: the tool group buttons, the Run speed test button, the target chips. Tools that need a big screen say so on the tile instead of disappearing.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Gauge needle sweeps on entry; tiles stagger in.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Phone layouts for every tool are design only.

**Phone: first run** (`PhoneSetup.dc.html`, 390 by 844, fixed root, interactive)

- Shows: First run on a phone, step by step with Back and Next (real state). Steps: owner account (the first account becomes the owner), connect with an app key or the router password, approve the host key fingerprint, firmware detection, language and theme. Tweaks > stage: ready (the wizard), loading (detecting firmware), success (all set), failure (wrong password or unreachable router) and empty (no router found on this network). Try: the step buttons, App key or Password, the reveal button, language buttons. Same steps and rules as the desktop Setup board.
- Tweaks: the six shared Tweaks plus `stage` (loading, empty, ready, success, failure).
- Dramatic motion: Step progress morphs; detection ripples around the router badge; success pops with confetti.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Phone layout of setup; desktop setup exists in the app with owner, connect and host key steps.

**Phone: settings, look, language, locks** (`PhoneSettings.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Where the settings family lands on a phone: notifications centre at the top (the bell opens this), then appearance (accent swatches, theme, motion), language modes with the funny-level slider and the vocabulary file drop, narrator and sounds, focus modes, locks with the authenticator, workspace tabs as a count chip, exports. Each desktop editor (infinite colour picker, animation editor, regex builder, New tab catalog) is reached through its row; none is removed. Try: every switch, slider and button here works with state.
- Tweaks: the six shared Tweaks.
- Dramatic motion: Notification cards slide in; controls morph on press.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Phone layouts for these settings are design only.

### Shared shell components (page id `components`)

**Navigation rail (shared component)** (`Rail.dc.html`, 288 px wide component, interactive)

- Shows: The navigation rail imported by every desktop board. Props: page (which destination is current), pending (count on the Review changes button) and the six shared Tweaks. Merlin extras disappears on stock firmware; the Review changes button turns read-only for viewers. Links point at the board for each destination.
- Tweaks: the six shared Tweaks plus its content props.
- Dramatic motion: Items shift on hover; the pending badge is static.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: The real app's rail has the same destinations without counts.

**Top bar (shared component)** (`TopBar.dc.html`, 1152 px wide component, interactive)

- Shows: The top bar imported by every desktop board: workspace tabs with close and New tab, router and firmware pills, the update-coming-soon pill, search with the adjacent regex button, language buttons, notifications, the surprise button, the page lock, the export menu and the account button, plus the version line (version, updated-at, source, signed-in role). Try: close a tab, add one, the regex button, the export menu, the lock.
- Tweaks: the six shared Tweaks plus its content props.
- Dramatic motion: The update pill carries a wavy progress mark; menus pop open.
- Normal motion: staggered entrances, hover, press and focus transitions on every control.
- Still unbuilt in the real app: Workspace tabs, export menu and page lock are design only.

## What the real app has today

The app in `public/` and `server/` has: first-run owner account, connect and host key approval; overview; devices; a settings catalogue rendered as switches, selects, sliders, number, IPv4, host name and password fields across Wi-Fi, internet, local network, firewall, port forwarding, parental controls, traffic priority, VPN and USB; logs; ping, traceroute and name lookup run on the router; the read-only scheduled jobs table; the advanced table; change history with undo; and the write path (preview, connection-loss guard for network changes, two-key confirmation for destructive actions). Everything else on the canvas is design only, as stated per board above.

## Known gaps in the canvas itself

- The older boards (Setup, Devices, Wi-Fi, Network, Security, Locks, Toolbox, Server manager, Language, Appearance) still show some typed fields where the newer boards show pickers. The pickers on Addresses and ports, Firewall, VPN and System are the reference to follow when those boards are next revised.
- Board heights in `canvas.json` were measured from a static pre-render of each board at 1440 px in a desktop browser, not inside the canvas runtime. Desktop boards use `expand: fill`, so a small difference only changes the empty space under a board.
- The boards were checked by static pre-render (every value hole resolves, tags balance, both languages, dark, stock firmware and viewer role render). They were not operated inside the live canvas runtime in this pass.
- The regex builder board lists its own parity gaps; it is not at full parity with the reference tool.
- The weekly schedule grid uses 30 px hour cells, below the 44 px target size; the day chips and quick-fill chips beside it are the full-size route.
- Captures on the documentation website board are placeholders until real captures of a built release exist.
