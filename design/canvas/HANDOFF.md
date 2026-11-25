# Material Asus Router: design handoff

This folder holds the design canvas for Material Asus Router, a self-hosted web app and Windows desktop app that manages an Asus router (stock ASUS or Asuswrt-Merlin) over SSH.

- `design/canvas/project` is the canvas project: 58 boards (56 screens plus the two shared shell components), `theme.css` and `canvas.json`.
- `design/canvas/generator` writes all of it. Run `node gen.mjs` in that folder. Nothing in `project` is edited by hand.
- `HANDOFF.md` (this file) is also written by the generator, from `handoff-head.md`, the board specifications and `handoff-tail.md`.

Demo data throughout: an RT-AX86U at 198.51.100.1 on the documentation network 198.51.100.0/24, outside addresses in 203.0.113.0/24 and 192.0.2.0/24, people named Pat and Alex.

## What changed in this pass

Every board was rebuilt from nothing; no markup from the earlier canvas was kept. Ten boards are new: One-click modes, Mode builder and the eight visual editors.

The owner's verdict on the earlier canvas was "too plain", "looks like a document", "never just text boxes", "missing animations and dramatic animations". The rebuild answers each point:

- **Layout.** Every desktop board is a hero zone over a bento grid of mixed-size tiles, not a column of fields. Phone boards fold the same hero and tiles into two columns.
- **Depth.** Hero zones are vivid tonal colour fields with an animated aurora behind frosted glass panels (`backdrop-filter`), soft multi-layer shadows and inner highlights. The rail and the search pill are glass as well.
- **Shape.** Material 3 expressive shapes (cookie, clover, flower, soft burst, blob, pill) are generated as polygons in `theme.mjs` and used as live containers: avatars, badges, the brand mark, mode card ornaments, the current pipeline step, the router cell on the address map.
- **Data visuals.** Gradient area charts, radial gauges, sparklines, heat maps, bar strips, a radar, wavy rings, a QR pattern and live network maps replace label and value rows.
- **Real controls.** There is no bare text box. Settings are switches, segmented buttons with a sliding indicator, sliders with units, steppers, a four-part IPv4 picker, a prefix stepper with a network-and-host bar, port pickers with presets, device pickers with MAC addresses, paintable grids, toggle chips and a password control with reveal and strength. The only typed fields are genuine free text (a network name, a host name, a mode name), each with a counter and, where it matters, a validation hint. The generator fails the build if any other kind of input appears.
- **Motion.** Described in the next section and listed per board below.

## Tweaks carried by every board

Every board, including the two shell components, declares the same Tweaks with the same names and defaults:

| Tweak | Editor | Default | Options |
| --- | --- | --- | --- |
| `accent` | colour | `#4f5bd5` | `#4f5bd5`, `#00897b`, `#d81b60`, `#f4511e`, `#7c4dff` |
| `dark` | boolean | `false` | |
| `motion` | enum | `expressive` | `calm`, `standard`, `expressive` |
| `firmware` | enum | `merlin` | `merlin`, `stock` |
| `role` | enum | `owner` | `owner`, `operator`, `viewer` |
| `lang` | enum | `en` | `en`, `yue`, `both` |
| `stage` | enum | `ready` | `loading`, `empty`, `ready`, `success`, `failure` |

`stage` is on all 56 screen boards (not on the two shell components, which have no stages). The shell components add their own content props: `page` and `pending` on the rail; `title`, `tabs` and `active` on the top bar.

What each Tweak does on every board:

- **accent** re-tones every colour role; all roles, the hero fields and the aurora are derived from the one accent in `theme.css`.
- **dark** flips every surface and text role.
- **motion** `calm` stills every animation and transition; `standard` keeps normal motion and removes the dramatic set; `expressive` plays everything. The operating system reduced-motion setting also stills everything. The resting frame is the designed frame: numbers show their final value, charts are fully drawn, tiles are in place.
- **firmware** changes the firmware name in the rail, top bar and heroes; Merlin-only tiles show locked with the reason on stock instead of disappearing.
- **role** `viewer` dims and disables every control that would change the router and shows a read-only strip. View-only controls (filters, the stage preview, tool pickers) stay usable.
- **lang** switches every string between English, Hong Kong Cantonese and both side by side.
- **stage** `loading` shows a shimmering skeleton of the bento; `empty` shows a morphing shape with one action; `success` adds a banner with a burst of shapes and a drawn tick; `failure` adds a banner that shakes, pulses red and slides the reason in. Each board has its own empty, success and failure wording. A small stage switch at the top of every board does the same from inside the board.

## Motion system

Motion lives in `theme.css` as keyframes and transitions. State computed in `renderVals` sets classes and inline custom properties (`--idx`, `--p`, `left`, `top`, path data), so interacting on the canvas replays the motion.

**Dramatic motion, only where it carries meaning** (removed by `standard`, stilled by `calm`):

- an aurora of three morphing, drifting colour fields behind every hero;
- shapes that morph between cookie, clover and flower (hero ornament, empty-state shape, active mode card);
- numbers that count up (an integer `@property`), and real countdowns on the guard, jobs and locks boards;
- chart lines that draw in with a gradient sweep across the filled area;
- a radar sweep with blips while scanning (setup, Wi-Fi, spectrum, phone setup);
- packets flowing along network-map links (`offset-path`), on the overview, mesh, internet, tools, map editor and VPN Director boards;
- a rotating wavy ring round countdowns and tunnel health;
- a conic-gradient border that rotates round the one focused action of each hero and the Apply action of the pending dock;
- success: a burst of shapes and a tick that draws itself; failure: a shake, a red pulse and the reason sliding in;
- the current pipeline step as a rotating cookie with a shimmering connector;
- skeleton shimmer while loading.

**Normal motion, everywhere:**

- staggered spring entrances for every tile (`--i`) and every list row (`--j`);
- hover lift and tilt on tiles, hover shift on rows, shape change on avatars;
- press scale and ripple on buttons; icon buttons morph from circle to squircle;
- switch thumbs that spring and grow a tick; segmented indicators and the tab indicator that slide with a spring;
- chips that expand to show their tick; focus rings that animate out;
- sheets, dialogs and the pending dock that rise with a scrim fade;
- bars, gauges and progress that grow from zero.

Nothing loops without a reason: the loops are the ambient hero aurora, live indicators, packets on live links, scanning, waiting rings and the focused-action border.

## Interactive boards

Every board is interactive: all 1 700 or so handlers are wired to board state, and the generator operates each one and re-renders the board as a check. The boards with their own logic beyond the shared controls:

- **One-click modes**: opening a mode, the preview sheet with old and new values, apply, undo.
- **Mode builder**: pick a palette card, drop it on the canvas, flip its value, remove it.
- **Network map editor**: pick a device, drop it on a node; block and reserve.
- **Rule canvas**: conflict detection, enable or disable, move a rule to another lane, add, remove.
- **Paint schedules** (and every other paintable grid): paint or erase a block with two clicks, presets, live counts.
- **Priority board**: reorder kinds of traffic; move devices between levels.
- **Channel spectrum**: band, channel and width; live score and best-channel jump.
- **Ports and VLAN**: carry a network to a port; tagging per port.
- **VPN Director**: route a device to a way out.
- **Address map**: move the pool ends by clicking cells, steppers and presets.
- **Regex builder**: ready patterns and the ignore-case flag run against the sample log lines.

A drag is two clicks on the canvas (pick, then place) because the canvas runtime exposes click handlers. The app should offer pointer drag and keep the two-click route as the keyboard and switch-access path.

## Pages and boards

### Setup and onboarding (page id `setup`)

**First run** (`Setup.dc.html`, 1440 wide, fills, interactive)

- Shows: First-run wizard as one stage, not a form: a five-step pipeline, a radar that sweeps the network for the router, the found router as a glass card, sign-in method as segmented buttons with an app key (default) or the router password, the host key as a fingerprint grid to approve, firmware detection and the look step.
- Try: the step buttons (Back and Next move the pipeline), App key or Password, the reveal eye, Approve host key, Tweaks > stage success (burst and tick) and failure (shake and reason), firmware, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Aurora behind the hero; a radar sweep with blips while the network is scanned; the current step badge is a rotating cookie; success bursts shapes and draws a tick; failure shakes with a red pulse and the reason slides in; the Next action has a rotating conic border.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the app first-run screens: owner account, connect, host key approval.
- Still unbuilt in the real app: Network scan radar, firmware detection summary and the look step are design only.

### Overview and notifications (page id `overview`)

**Overview** (`Main.dc.html`, 1440 wide, fills, interactive)

- Shows: The dashboard as a bento: a hero with the live download rate counting up over an aurora, a glass live-traffic chart that draws in, four tonal number tiles with sparklines, the home network map with packets moving along every link, band gauges, quick switches that queue into pending changes, busiest devices, an hourly heat map and recent changes with undo.
- Try: the quick switches (the dock rises with a count and Apply under guard), the chart range buttons, Tweaks > stage loading (skeleton shimmer) and empty, motion calm (everything stills on the designed frame), accent, dark, lang, role viewer.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Tiles arrive in a staged sequence; the hero number counts up; the traffic line draws in with a gradient sweep; packets flow along the map links; the speed-test action has a rotating conic border; the hero shape morphs between cookie, clover and flower.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the app overview screen: model, firmware, uptime, clients.
- Still unbuilt in the real app: Live traffic chart source, network map, heat map and quick switches are design only.

**Notifications** (`Notifications.dc.html`, 1440 wide, fills, interactive)

- Shows: Notification centre: a hero with the unread count and a week of activity as bars, a live stack of toasts sliding in, the feed as rows with kind avatars, status chips and inline actions, per-kind switches, quiet hours as a paintable day strip and a slider for how long toasts stay.
- Try: the kind filter chips, the per-kind switches, quiet hours cells (click one, then another), the toast seconds slider, Tweaks > stage empty and failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Toasts fly in from the right in sequence; the unread number counts up; unread dots pulse; failure shakes the banner.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the simple toasts the app shows after an action.
- Still unbuilt in the real app: The centre, snooze, per-kind switches and quiet hours are design only.

### One-click modes (page id `modes`)

**One-click modes** (`Modes.dc.html`, 1440 wide, fills, interactive)

- Shows: Seven large mode cards (Gaming, Bedtime, Guest party, Work from home, Privacy DNS, Lock it down, Away). Each one is a real bundle of router changes. Tapping a card opens a preview sheet listing every change with its old and new value; Apply runs the bundle through preview, guard and undo; an active card shows On now and a one-tap Undo.
- Try: tap any card (the sheet rises from the right with the exact changes), Apply under guard, then Undo on the card; open Guest party to see the QR card; Tweaks > role viewer (cards open, apply is off), stage success and failure, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Mode cards arrive staggered and tilt and round on hover; the active card has a morphing shape and a coloured ring; the sheet rises with a scrim fade and its change rows cascade in; the hero Apply action has a rotating conic border; success bursts; failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the write path that already exists (preview, connection-loss guard, change history with undo), applied to several settings at once.
- Still unbuilt in the real app: Modes do not exist in the app; the bundles, the access limit timer and the QR card are design only.

**Mode builder** (`ModeBuilder.dc.html`, 1440 wide, fills, interactive)

- Shows: A builder canvas for your own mode: a palette of real router settings grouped by area on the left, a dotted canvas on the right that holds the settings in the mode as cards, each with a real switch for the value the mode will set and a remove button, plus the mode name (with a counter), icon, colour and when it turns itself off.
- Try: click a palette card (it lifts and the canvas shows a dashed drop outline), then click the canvas to drop it; flip the switch on a card; remove a card; the icon and colour buttons; Tweaks > stage failure for the conflict message.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The picked card lifts and tilts while the canvas outline breathes; dropped cards spring in; the save action has a rotating conic border; a conflicting pair shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the settings catalogue (each palette card is one catalogue entry).
- Still unbuilt in the real app: The builder does not exist in the app. On the canvas a drag is two clicks (pick, then drop); the app would use pointer drag with the same keyboard route.

### Devices (page id `devices`)

**Devices** (`Devices.dc.html`, 1440 wide, fills, interactive)

- Shows: Everyone on the network as cards in a bento, not a table: a hero with the device count and a band split, each device with an icon tile, signal bars, live rate sparkline, status chip and inline switches for block and reserve; a focused device panel with priority, owner and address pickers.
- Try: the filter chips, block and reserve switches on any row (the dock counts them), the focused device picker, priority buttons and the last-octet address stepper, Tweaks > role viewer, stage empty and failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The device count counts up over an aurora; the newest device has a pulsing ring; sparklines draw in; failure shakes and names the clashing reservation.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the app devices screen (name, address, MAC, band).
- Still unbuilt in the real app: Signal history, per-device live rate, owner assignment and bulk actions are design only.

### Wi-Fi and AiMesh (page id `wifi`)

**Wi-Fi** (`WiFi.dc.html`, 1440 wide, fills, interactive)

- Shows: Three band tiles in strong tonal colours, each with a radio switch, a channel gauge, width as segmented buttons, power as a slider and the client count; a radar that sweeps for neighbouring networks; the network name with a counter; security as segmented buttons; the password with strength; and the guest network with its QR card.
- Try: flip a radio, change width or power (the dock rises), security buttons, the reveal eye, guest switch, Tweaks > stage success and failure (both are guard outcomes), firmware, role viewer.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: A radar sweeps while neighbours are scanned; band gauges draw; the hero number counts up; success bursts when the guard keeps a change; failure shakes when it rolls back.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the Wi-Fi band settings in the catalogue: radio, name, hidden, security, password, channel, width, power, guest.
- Still unbuilt in the real app: The neighbour radar and the guest QR card are design only; the channel spectrum editor is its own board.

**AiMesh** (`Mesh.dc.html`, 1440 wide, fills, interactive)

- Shows: The mesh as a live map: router and two nodes with backhaul links, packets flowing along healthy links and a dashed amber link for the weak one; a tile per node with a backhaul quality gauge, uplink type as segmented buttons and its clients; roaming assistant threshold as a slider.
- Try: the uplink buttons and switches on a node tile, the roaming slider, Restart node, Tweaks > stage empty and failure, firmware, role viewer.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Packets flow along backhaul links; link lines draw in and nodes pop in order; quality gauges draw; the weak link is a moving dashed line; failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the AiMesh domain in the catalogue (node list is read from the router).
- Still unbuilt in the real app: Topology map, backhaul quality, per-node clients and node actions are design only.

### Internet, local network, ports, traffic priority (page id `network`)

**Internet** (`Network.dc.html`, 1440 wide, fills, interactive)

- Shows: The internet side: a hero with the public address and a live latency line, connection type as large segmented buttons, DNS as resolver cards with a privacy switch, a world path from router to provider to the internet with moving packets, dynamic DNS and the WAN details as real controls.
- Try: the connection type buttons, the DNS privacy switch and resolver picker, MTU slider, dynamic DNS switch (the dock counts the changes and Apply runs under the guard), Tweaks > stage success and failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Aurora hero; the latency line draws in with a sweep; packets travel the path from router to the internet; the public address chip pulses while live; guard success bursts and failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the internet domain in the catalogue: connection type, DNS servers, DNS privacy, MTU, dynamic DNS.
- Still unbuilt in the real app: Latency history, the path picture and resolver speed comparison are design only.

**Local network** (`Lan.dc.html`, 1440 wide, fills, interactive)

- Shows: The local network without a single typed address: the router address as a four-part picker with a stepper, the prefix as a stepper beside a network-and-host bar, the DHCP pool as a miniature address map, reservations as device rows with address steppers, and port forwards as rows with port chips and switches.
- Try: the last-octet stepper and prefix stepper (the bar moves), lease slider, reservation switches, port presets, forward switches, Tweaks > stage success and failure (changing the router address runs under the guard).
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Hero number counts up over the aurora; the mini address map cells pop in as a wave; the network bar slides with a spring; guard outcomes burst or shake.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the local network and port forwarding domains: router address, mask, DHCP start and end, lease time, reservations, forwards.
- Still unbuilt in the real app: The pickers and mini map are design; the app has a plain IPv4 field. The full editors are the Address map and Rule canvas boards.

**Traffic priority** (`Qos.dc.html`, 1440 wide, fills, interactive)

- Shows: Who is using the line right now as a stacked live picture: a hero with total throughput, a stream per kind of traffic, a gauge for how full the line is, the mode as segmented buttons, the line speeds as sliders, and the busiest devices with a priority control on every row.
- Try: the mode buttons, line sliders, the High/Normal/Low buttons on each device, the game boost switch, then Apply in the dock; Open the priority board for the ordered editor.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The throughput number counts up; two traffic lines draw in with a sweep; the line gauge draws; bars grow in sequence.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: traffic priority (QoS) in the catalogue: mode, upload and download bandwidth.
- Still unbuilt in the real app: Live per-kind streams and waiting-time measurements are design only.

### Firewall, parental controls, VPN (page id `security`)

**Security overview** (`Security.dc.html`, 1440 wide, fills, interactive)

- Shows: One security picture: a score ring in the hero, the three open findings as large cards with a one-switch fix each, blocked knocks on a world-hours heat map, and summaries of firewall, parental controls and VPN that link to their own boards.
- Try: flip the fix switches on the finding cards (each joins the dock), Fix all three, Tweaks > stage success and failure, firmware, role viewer.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The score ring draws and its number counts up; finding cards arrive staggered; the worst finding has a pulsing chip; Fix all has a rotating conic border; success bursts.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: firewall, WPS, remote access and VPN server switches in the catalogue, read together.
- Still unbuilt in the real app: The score, findings and blocked-knock heat map are design only.

**Firewall** (`Firewall.dc.html`, 1440 wide, fills, interactive)

- Shows: The firewall as a shield, not a settings list: a hero with knocks blocked today and a live strike chart, big switch tiles for the four protections, the open doors as port chips with switches, and a blocked-address list with a block-range picker.
- Try: the protection switches, the door switches, the block length buttons and prefix stepper, Tweaks > stage empty (firewall off) and failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The blocked count counts up; a strike chart draws in; the shield shape morphs behind the hero; failure shakes with the bad address as the reason.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the firewall domain: firewall on/off, DoS protection, respond to ping, logged packets.
- Still unbuilt in the real app: Live blocked chart, the address block list with ranges and the outside port test are design only. The lane editor is the Rule canvas board.

**Parental controls** (`Parental.dc.html`, 1440 wide, fills, interactive)

- Shows: Family time as people, not rules: a hero with today's remaining time as a big number and ring, one tonal card per person with their devices, a pause switch and a daily limit slider, the week painted on a grid, and content filters as chips.
- Try: Pause on a person card, the daily limit slider, paint the week (click one cell then another), the filter chips, Add 30 minutes, Tweaks > stage failure, role viewer.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The remaining-minutes number counts up inside a rotating wavy ring; person cards arrive staggered; painted cells pop; failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: parental controls in the catalogue: time scheduling per device (MULTIFILTER keys).
- Still unbuilt in the real app: People grouping, daily limits, bonus time and content filter chips are design only; the full paint editor is the Paint schedules board.

**VPN** (`Vpn.dc.html`, 1440 wide, fills, interactive)

- Shows: VPN both ways: a hero with connected peers and a tunnel throughput line inside a rotating ring, the WireGuard and OpenVPN servers as tiles with switches and port pickers, peers as rows with a QR card, and client tunnels with health gauges.
- Try: server switches, the port presets and stepper, peer switches, the kill switch; on stock firmware WireGuard shows the reason it is unavailable on this model instead of disappearing.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: A wavy ring rotates around the peer count; the tunnel line draws in; the QR pattern assembles cell by cell; success bursts when a peer is added.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the VPN domain: OpenVPN and WireGuard server switches and ports.
- Still unbuilt in the real app: Peer management with QR, client tunnel health and throughput are design only. Per-device routing is the VPN Director board.

### Visual editors (page id `editors`)

**Editor: drag-and-drop network map** (`MapEditor.dc.html`, 1440 wide, fills, interactive)

- Shows: A drag-and-drop map of the real network: the router and two AiMesh nodes with backhaul quality on the links, every device as a round tile hanging from the node it uses, packets moving along live links, and a side panel for the picked device (rename, reserve, block, bind to a node).
- Try: click a device (it lifts), then click another node: the device glides across, its link redraws and a pending change appears; flip Block (its link goes dashed and packets stop) and Reserve; Tweaks > role viewer, stage, motion calm.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Packets flow along every live link; a moved device glides to its new node with a spring while its link redraws; drop targets breathe while a device is held; the weak backhaul is a dashed amber line.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the devices list, DHCP reservations, MAC filter and the AiMesh node list, shown as one picture.
- Still unbuilt in the real app: The map editor is design only. Drag is pick-then-place on the canvas.

**Editor: firewall and port-forward rule canvas** (`RuleCanvas.dc.html`, 1440 wide, fills, interactive)

- Shows: A rule canvas with a lane per destination (the router itself and each device). Every rule is a card with its port as a chip, a protocol tag and a real on/off switch. Two rules that claim the same outside port are outlined in red, shake once and are counted in the hero.
- Try: two rules clash on TCP 443 when the board opens: switch one off and the red outline and the count clear; click a card to pick it, then click another lane to move the rule to that device; build a new rule with the port picker, protocol and device picker, then Add rule; remove a card.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Packets stream along the internet-to-router-to-device bar; clashing cards shake with a red outline; picked cards lift while the other lanes breathe as drop targets; the conflict count is a pulsing chip.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the port forwarding list and firewall switches in the catalogue.
- Still unbuilt in the real app: The lane canvas, conflict detection and outside port test are design only.

**Editor: paint-to-schedule grids** (`SchedulePaint.dc.html`, 1440 wide, fills, interactive)

- Shows: Two week grids you paint instead of filling in: internet hours for a child's device and the hours the Wi-Fi radios stay on. Each has a paint or erase brush, presets, a live count of painted hours and a device or band picker.
- Try: click one cell, then another: the whole block between them is painted; switch the brush to Erase and do it again; the presets (School nights, Weekends, Always); pick another device; the dock shows the pending change.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Painted cells pop in with a spring; the block anchor pulses as a ring; the allowed-hours number counts up; failure shakes and explains the wrong clock.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the parental time schedule and the wireless schedule in the catalogue.
- Still unbuilt in the real app: The paint grids are design only; the app shows these as plain values. Drag-painting becomes click-then-click on the canvas.

**Editor: drag-to-order traffic priority board** (`PriorityBoard.dc.html`, 1440 wide, fills, interactive)

- Shows: A drag-to-order board: seven kinds of traffic as ranked cards, each showing the share of the line it is guaranteed, with up and down buttons; below it, four priority lanes that hold the devices; and line speed limits as sliders.
- Try: the up and down arrows on a card (cards trade places, shares re-flow); click a card grip then another card to move it there; click a device, then a lane, to change its level; the upload and download sliders.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Share bars grow from the left and re-flow when the order changes; the picked card lifts and tilts; the first-place badge is a rotating cookie; drop targets breathe.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: traffic priority (QoS) settings in the catalogue: mode, order, bandwidth.
- Still unbuilt in the real app: The ordered board and per-device lanes are design only; the app shows these as selects.

**Editor: Wi-Fi channel spectrum** (`Spectrum.dc.html`, 1440 wide, fills, interactive)

- Shows: The air around the house as a spectrum: every neighbouring network is a grey bell curve at its channel, yours is a bright curve you move by picking a channel and a width. A live score says how crowded your position is and one button jumps to the quietest channel.
- Try: click the channel buttons: your curve slides and the score recomputes; change the width (the curve widens and swallows more neighbours); switch band; Move to the quietest channel; Tweaks > stage failure for the radar message.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: A radar sweeps while scanning; neighbour curves grow up from the floor in sequence; your curve slides between channels with a spring and breathes; the score number counts.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: channel and channel width for each band in the catalogue.
- Still unbuilt in the real app: The neighbour scan and the spectrum view are design only. Dragging the curve becomes picking a channel on the canvas.

**Editor: VLAN and IPTV port canvas** (`PortCanvas.dc.html`, 1440 wide, fills, interactive)

- Shows: The back of the router drawn as a panel of real jacks. Each port glows in the colour of the network it carries. Pick a network card, then click a port to carry it there. A row per port has a real switch for tagged or untagged, and a provider profile fills the panel in one go.
- Try: pick the IPTV card, click LAN 3 (its jack changes colour and the pending dock rises); flip Tagged on a port row; the provider profile buttons; Tweaks > stage failure (the guard refuses to cut this computer off).
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Port lamps pulse in their network colour; the picked network card lifts while free ports breathe as drop targets; jacks rise on hover; failure shakes with the lock-out reason.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the IPTV, LAN port and VLAN settings (switch_wantag, switch_stb_x and related keys).
- Still unbuilt in the real app: The back-panel canvas and profile presets are design only.

**Editor: VPN Director routing canvas** (`VpnDirector.dc.html`, 1440 wide, fills, interactive)

- Shows: Devices on the left, three ways out on the right (the plain internet and two VPN tunnels). A coloured stream with moving packets runs from every device to the way out it uses. Pick a device, then click a destination: its stream bends over to the new one.
- Try: click a device card, then a destination: the stream re-routes and recolours; the kill switch and tunnel switches; Tweaks > firmware stock (the whole canvas shows locked with the reason, because VPN Director is Merlin only), stage failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Packets flow along every route in the colour of its exit; a re-routed stream redraws; the held device lifts while destinations breathe; the tunnel health rings rotate.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: VPN Director policy rules on Asuswrt-Merlin (vpndirector_rulelist) and the VPN client switches.
- Still unbuilt in the real app: The routing canvas and leak test are design only.

**Editor: DHCP address-space map** (`DhcpMap.dc.html`, 1440 wide, fills, interactive)

- Shows: The whole 198.51.100.0/24 subnet as a grid of 256 cells, coloured by what each address is: the router, reserved, leased now, free inside the pool, free outside it. The pool is the tinted band; its two ends are the ringed cells.
- Try: click any cell: the nearer end of the pool jumps there, the band, the free count and the fill gauge follow; the start and end steppers; the three presets; shrink the pool until a reservation falls outside and the warning chip appears.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: All 256 cells pop in as a wave; pool edges are pulsing rings; the fill gauge redraws and the free number counts; the router cell is a cookie shape.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: DHCP start, DHCP end, lease time and the reservation list (dhcp_start, dhcp_end, dhcp_staticlist).
- Still unbuilt in the real app: The address map is design only. Dragging a pool edge becomes clicking a cell.

### USB and storage (page id `storage`)

**USB and storage** (`Storage.dc.html`, 1440 wide, fills, interactive)

- Shows: Storage as a picture of the drive: a hero ring with how full it is, the kinds of files as a stacked bar and tiles, sharing services as switch tiles, people with access as rows with read or write buttons, and drive health with a temperature line.
- Try: Eject (success) and try again with Tweaks > stage failure (busy), the sharing switches, the per-person access buttons, the sleep slider, Tweaks > stage empty.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The used-space ring draws and its number counts up; the stacked usage bar grows; the drive lamp pulses while a transfer is live; success bursts on a clean eject; failure shakes when the drive is busy.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the USB domain: file sharing (Samba), FTP, media server switches.
- Still unbuilt in the real app: Usage breakdown by kind, per-person access, health and eject are design only.

### Logs, network tools, router tools, scheduled jobs (page id `tools`)

**Logs and tools** (`Tools.dc.html`, 1440 wide, fills, interactive)

- Shows: The router's own tools as an instrument panel: a target picker with presets, a ping panel with a live latency line and a big average, a hop-by-hop trace drawn as a path with packets, and the live log as a terminal with level chips and a regex-builder button.
- Try: the tool buttons, target device picker, count stepper, the level chips on the log, Tweaks > stage success and failure, role viewer (tools still run, they do not change the router).
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The ping line draws in and its newest point pulses; packets run along the trace path; log lines arrive one by one with a blinking cursor; failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the app tools screen (ping, traceroute and name lookup run on the router) and the logs screen.
- Still unbuilt in the real app: Live latency line, the drawn trace path and live log streaming are design only.

**Speed lab** (`SpeedLab.dc.html`, 1440 wide, fills, interactive)

- Shows: A speed test that feels like an instrument: a huge dial with a counting number in the hero, phases as a pipeline (latency, download, upload), the run drawn live, history as bars against the plan you pay for, and a schedule with a painted strip for when tests may run.
- Try: Start (success), the server picker, the plan slider (the "of plan" figure is against it), the schedule cells, Tweaks > stage loading, success and failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The dial sweeps up as the number counts; the current phase badge is a rotating cookie with a shimmering connector; the run line draws with a gradient sweep; Start has a rotating conic border; success bursts.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: nothing yet in the app; the router has a built-in speed test command this would call.
- Still unbuilt in the real app: The whole board is design only.

**Router utilities** (`Utilities.dc.html`, 1440 wide, fills, interactive)

- Shows: Everyday router jobs as big tappable tiles rather than a menu: restart Wi-Fi, wake a sleeping device, share the Wi-Fi as a QR card, find a device by blinking the router lights, night mode for the lights on a painted strip, and a password generator with strength.
- Try: the device picker and Wake, the QR band buttons, lights switch and brightness slider, night-mode cells, password length slider and character chips, Tweaks > stage success and failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Tiles arrive staggered and tilt on hover; the QR assembles cell by cell; a wake ring pulses out from the picked device; success bursts.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: wake-on-LAN and the LED switch exist as router commands and catalogue entries; the rest are composed from existing settings.
- Still unbuilt in the real app: QR sharing, the generator and night mode strip are design only.

**Scheduled jobs** (`Jobs.dc.html`, 1440 wide, fills, interactive)

- Shows: Scheduled jobs on a 24-hour ring and a week grid instead of a table of timer expressions: a hero with the next job counting down, each job as a row with a real switch and a run-now button, the week as a painted grid, and the last runs as a bar strip.
- Try: job switches, Run now, paint the weekly restart window, the hour stepper, Tweaks > firmware stock (custom scripts lock with the reason), stage failure for a collision.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: A wavy ring rotates round the countdown, which really counts down; run bars grow in order; a colliding pair shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the read-only scheduled jobs table the app shows from the router.
- Still unbuilt in the real app: Creating and editing jobs, the ring and run history are design only.

### Firmware, system, maintenance, backup, advanced, Merlin (page id `router`)

**Firmware** (`Firmware.dc.html`, 1440 wide, fills, interactive)

- Shows: A firmware update you can watch: a hero with the installed and the offered build, the update as a six-step pipeline with a progress bar and a countdown ring, what changes as chips, the safety net (automatic backup, checksum, what happens if power fails) and build history as a timeline.
- Try: Update now (success burst) and Tweaks > stage failure (checksum refusal), the update channel buttons, the automatic backup switch, firmware stock (the offered build and channel names change).
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The current pipeline step is a rotating cookie with a shimmering connector; the progress bar shimmers; a wavy ring rotates round the minutes remaining; Update now has a rotating conic border; success bursts and failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the firmware domain: installed version and the check-for-update command.
- Still unbuilt in the real app: In-app flashing, checksum verification, the pipeline and release notes are design only.

**System** (`System.dc.html`, 1440 wide, fills, interactive)

- Shows: The router as a machine: a hero with uptime and three live gauges (processor, memory, temperature), a 24-hour load chart, the clock and time zone as pickers, how the router can be reached (SSH, web page, from outside) as switch tiles with port pickers, and maintenance actions that open the takeover.
- Try: the access switches (turning SSH off is refused: Tweaks > stage failure), port presets, time zone buttons, the restart action (goes to the takeover board), role operator and viewer.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Three gauges draw in and their numbers count up; the load line draws with a sweep; the uptime number counts; failure shakes with the lock-out reason.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the system and maintenance domains: time zone, NTP server, SSH, web access, restart and factory reset actions.
- Still unbuilt in the real app: Live gauges and load history are design only.

**Backup and restore** (`Backup.dc.html`, 1440 wide, fills, interactive)

- Shows: Backups as a timeline of snapshots: a hero with how fresh the newest one is, each backup as a card with size, setting count and a restore button, a compare view listing exactly which settings differ from now, the nightly schedule, where copies go and the password that encrypts them.
- Try: Back up now (success), Restore on an older snapshot (opens the diff), the destination switches, the keep-count slider, Tweaks > stage failure (wrong model refused), role operator (restore is owner only).
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The age number counts up over the aurora; snapshot cards cascade in; diff rows slide in one after another; Back up now has a rotating conic border; success bursts; failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the backup domain: save and restore the router settings file.
- Still unbuilt in the real app: Encrypted archive, snapshots timeline, compare view and off-router destinations are design only.

**Advanced** (`Advanced.dc.html`, 1440 wide, fills, interactive)

- Shows: Every remaining router value without looking like a spreadsheet: a hero with how many values exist and how many you changed, areas as a heat map of where the changes are, values as rows with the readable label first and the raw key second, each with the right control for its type, and Merlin extras as lockable tiles.
- Try: the area chips, the controls on each row (switch, stepper, segmented), Show secrets (owner only), Tweaks > firmware stock (Merlin extras lock with the reason), role operator and viewer, stage failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Counts count up; heat cells pop in as a wave; rows cascade; failure shakes with the allowed range.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the app advanced table (every nvram value, catalogue label first, secrets masked).
- Still unbuilt in the real app: Typed controls per row, the change heat map and Merlin add-on management are design only.

### Change history, write stages, takeovers, exports (page id `changes`)

**Change history** (`Changes.dc.html`, 1440 wide, fills, interactive)

- Shows: The write path in one place: a hero with the pending count, each pending change as a before-and-after card with its risk level, the four-step write pipeline (preview, write, guard, keep), history as a timeline with undo on every entry, and who changed what as bars.
- Try: Apply under guard (success burst), Discard, Undo on a history row, the risk filter chips, Tweaks > stage failure (guard rollback), role viewer (can read, cannot apply).
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Before-and-after rows slide in one after another; the pending number counts up; the current pipeline step rotates; Apply has a rotating conic border; success bursts shapes with a drawn tick; failure shakes with a red pulse while the reason slides in.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the app change history with undo and the write path (preview, connection-loss guard for network changes, two-key confirmation for destructive ones).
- Still unbuilt in the real app: Batching several pending changes into one guarded apply and the activity bars are design only.

**Takeovers: connection-loss guard and two-key confirmation** (`Takeover.dc.html`, 1440 wide, fills, interactive)

- Shows: The moment a risky change is live: a full-width guard with a real countdown inside a rotating wavy ring, one large "I am still connected" action, what will be restored if time runs out, the live reconnect signal, and below it the two-key confirmation used for destructive actions (factory reset, firmware), where both keys must be turned.
- Try: I am still connected (success burst), Roll back now, Tweaks > stage failure (time ran out), the two key switches (the destructive button only arms when both are on), role operator (the second key is owner only).
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: A wavy ring rotates round a number that really counts down from 60; the confirm action has a rotating conic border; the reconnect line draws; success bursts shapes with a tick; failure shakes with a red pulse and the reason slides in.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the connection-loss guard for network changes and the two-key super confirmation for destructive actions; both exist in the app.
- Still unbuilt in the real app: The reconnect signal line and the wavy ring are design; the logic exists.

**Records and exports** (`Records.dc.html`, 1440 wide, fills, interactive)

- Shows: Exports as something you assemble: pick what goes in (toggle chips), the format (large segmented tiles), the date range on a painted month strip, see a live page preview with the size, and below it the audit trail of who exported what.
- Try: the content chips and format buttons, paint the day range, Include secrets (owner only, off by default), Build export (success), Tweaks > stage failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The page preview sheets fan in; the size number counts up; Build has a rotating conic border; success bursts.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: change history and the device list, which the app can already show; export formats are the app-wide requirement.
- Still unbuilt in the real app: All exports (PDF, CSV, JSON, Markdown), the preview and the audit trail are design only.

### Settings, tabs, appearance, language, modes, locks, regex, updates (page id `app`)

**Settings** (`Settings.dc.html`, 1440 wide, fills, interactive)

- Shows: App settings as tiles of real controls grouped by task: a hero that searches settings through a button, quick links to the deeper boards (appearance, language, locks, tabs), people and their roles as rows with role buttons, sounds with a switch and volume, start-up behaviour and data.
- Try: role buttons per person, the sound switch and volume slider, start-up chips, Reset this group, Tweaks > role operator and viewer (accounts lock), lang, dark.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Tiles arrive staggered; quick-link shapes morph on hover; the hero search action has a rotating conic border.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the owner account and the language and theme choices the app stores today.
- Still unbuilt in the real app: Roles for more people, action sounds, start-up options and settings search are design only.

**Tabs and new tab** (`Tabs.dc.html`, 1440 wide, fills, interactive)

- Shows: How tabs work: one workspace tab per router, a row of open page tabs with a travelling indicator, and the New tab catalogue as a bento of every destination with its icon, grouped by area, with a search button beside the regex builder button and an Open every tab action.
- Try: the tab strip (the indicator springs across), the area chips, pin switches, tab position buttons, Open every tab, Tweaks > lang, dark, firmware stock (Merlin tabs show their lock).
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Catalogue tiles cascade in and tilt on hover; the tab indicator travels with a spring; the Open every tab action has a rotating conic border.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the app navigation between screens.
- Still unbuilt in the real app: Tabs, the catalogue, pinning and tab layout are design only.

**Appearance** (`Appearance.dc.html`, 1440 wide, fills, interactive)

- Shows: The look, edited live: accent as large swatches, light or dark, corner shape and density as segmented buttons, type size as a slider, a preview that uses the same components as the app, and the motion editor with a profile, a global speed and a duration, delay and distance slider per kind of motion.
- Try: accent swatches here mirror Tweaks > accent (change the Tweak to re-tone the whole board), the profile buttons, the per-kind switches and sliders, the speed slider; set Tweaks > motion to calm to see the editor say that reduced motion wins.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Every preview shape morphs; the sample card replays its entrance; the hero shape cycles cookie, clover, flower; a conic border rotates on the Apply profile action. With motion calm all of it stills and a notice explains why.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the light and dark theme choice in the app.
- Still unbuilt in the real app: Accent choice, shape, density, type size and the whole motion editor are design only.

**Language and wording** (`Language.dc.html`, 1440 wide, fills, interactive)

- Shows: Language as a live comparison: three large cards (English, Cantonese, both side by side) with the same sample screen in each, a tone slider from plain to playful with a live sample sentence, number and time formats as segmented buttons, and a drop zone for a personal wording file that stays on this computer.
- Try: the three language cards (they mirror Tweaks > lang: change the Tweak to translate the whole board), the tone slider, format buttons, the wording file switches, Tweaks > stage success and failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Language cards arrive staggered and tilt on hover; the picked card has a rotating conic ring; the drop zone outline breathes; success bursts when a wording file loads.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the English and Cantonese labels every catalogue entry already carries.
- Still unbuilt in the real app: Both-at-once mode, tone levels and the personal wording file are design only.

**App modes** (`Focus.dc.html`, 1440 wide, fills, interactive)

- Shows: Ways to run the app itself (not the router): Simple, Expert, Low stimulation, School and Presentation as large mode cards with what each one hides or shows, a before-and-after strip of the same screen in two modes, and switches for what a mode does.
- Try: pick a mode card, the detail switches per mode, the timer stepper for School mode, Tweaks > motion calm (Low stimulation implies it), role viewer.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Mode cards arrive staggered, tilt and round on hover and the picked one grows a coloured ring with a morphing shape; with Low stimulation picked the board says motion is off.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: nothing yet; the app has one layout.
- Still unbuilt in the real app: All five app modes are design only. Router bundles are the separate One-click modes board.

**Locks and permissions** (`Locks.dc.html`, 1440 wide, fills, interactive)

- Shows: Who can do what, as a picture: a hero with the lock state and idle timer in a ring, the three roles against every area as a paintable permission grid, per-area locks as switch tiles, signed-in sessions as rows with a sign-out button, and what always needs two keys.
- Try: paint the permission grid (click a cell, then another), the idle slider, area lock switches, Sign out on a session, Lock now (success), Tweaks > role operator and viewer, stage failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: A wavy ring rotates round the idle countdown; permission cells pop as they are painted; failure shakes the banner with the tries left.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the owner account, encrypted secrets and two-key confirmation that exist today.
- Still unbuilt in the real app: App lock, operator and viewer roles, the permission grid, per-area locks and sessions are design only.

**Regex builder** (`Regex.dc.html`, 1440 wide, fills, interactive)

- Shows: A pattern you build from pieces: the pattern is a row of coloured token chips, each explained in words underneath; a library of ready patterns as segmented buttons; flags as toggle chips; and a live test against real router log lines with every match highlighted and counted.
- Try: the pattern buttons (tokens, explanation and highlighted matches all change, computed live), the Ignore case flag, Tweaks > lang, dark. The search bars on other boards open this builder.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Token chips cascade in; matched text is a highlighted pill that pops; the match count counts; log lines arrive one by one.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: plain search on the app logs screen.
- Still unbuilt in the real app: The builder is design only and is far from full parity with a dedicated regex tool: no token editing by hand, no replace, no flavours other than JavaScript, no debugger, no library saving.

**App updates** (`Updates.dc.html`, 1440 wide, fills, interactive)

- Shows: App updates you can see coming: a hero for a build that is being made right now (Update coming soon) with its number, a pipeline of build stages each with its own state, start time and elapsed time, a labelled estimate, what the build will contain, and when it becomes an ordinary offer.
- Try: Tweaks > stage (loading, empty = up to date, success = updated, failure = checksum), the channel buttons, the install-when buttons, role viewer.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The current build stage is a rotating cookie with a shimmering connector; the progress bar shimmers; a wavy ring rotates round the estimate; success bursts; failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the app version shown in settings.
- Still unbuilt in the real app: Self-update, Update coming soon with live build stages and update history are design only.

### Toolbox and server manager (page id `toolbox`)

**Toolbox** (`Toolbox.dc.html`, 1440 wide, fills, interactive)

- Shows: Network helpers that need no router: a subnet calculator driven by a prefix stepper with a network-and-host bar and counts, a QR maker, a MAC vendor lookup with a device picker, a port reference as chips, a unit converter with sliders and a signal-strength guide as a gauge.
- Try: the prefix stepper (bar and counts follow), the last-octet stepper, the port preset chips, the converter slider, the signal slider, Tweaks > lang, dark.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Tool tiles arrive staggered and tilt on hover; the QR assembles; the bar slides with a spring; the gauge redraws.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: nothing yet; these are app-side tools that do not talk to the router.
- Still unbuilt in the real app: The whole toolbox is design only.

**Minecraft server manager** (`ServerManager.dc.html`, 1440 wide, fills, interactive)

- Shows: A Minecraft server creator and manager that sits naturally in a router app, because a server needs a reserved address and a port forward: server cards with players and memory gauges, a create flow as pickers (edition, version, flavour, target), the four run targets as large cards, a live console and the router wiring it needs.
- Try: the edition and flavour buttons, version stepper, target cards, memory slider, Start (success), Tweaks > stage failure (out of memory), role operator.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Player and memory gauges draw; console lines arrive one by one with a blinking cursor; the start action has a rotating conic border; success bursts; failure shakes with the reason.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: nothing yet. The router side (reserve an address, forward a port) already exists in the write path.
- Still unbuilt in the real app: The whole server manager is design only: version discovery, plugin install and the four targets (local process, local Docker, SSH process, SSH Docker).

### Deploy assistant and instances (page id `deploy`)

**Deploy assistant** (`Deploy.dc.html`, 1440 wide, fills, interactive)

- Shows: One-click deployment of the web app form of this app: five targets as large cards (Docker, VirtualBox, VMware, USB stick for a spare PC, Raspberry Pi card), a deployment pipeline with live progress, the instance manager with health and actions per instance, and the working link as a QR after each deploy.
- Try: pick a target card, the port presets, Deploy (success with the link), Tweaks > stage failure (port clash), instance switches and actions, role operator (flashing a disk is owner only).
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Target cards arrive staggered and tilt; the current pipeline step rotates with a shimmering connector; the link QR assembles; Deploy has a rotating conic border; success bursts; failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the app already runs as a self-hosted web app and as a Windows desktop app.
- Still unbuilt in the real app: The deploy assistant, appliance images, virtual machine import, disk flashing and the instance manager are design only.

### Documentation website and offline docs (page id `docs`)

**Documentation website** (`Docs.dc.html`, 1440 wide, fills, interactive)

- Shows: The public documentation website: a hero that leads with tasks instead of a file list, task cards with icons and reading time, an interactive "what happens when you apply a change" walkthrough with step buttons, an article reader preview with contents, and the delivery forms (website, offline app, phone PDF).
- Try: the walkthrough step buttons (the pipeline and the explanation move), the task filter chips, the reading-size slider, the edition buttons, Tweaks > lang, dark.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Task cards cascade in and tilt; the walkthrough pipeline step rotates and its connector shimmers; the hero search action has a rotating conic border.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the documentation website published with the project (99 articles, a wiki and a phone PDF edition).
- Still unbuilt in the real app: This board is the design the website should move toward; screenshots in it are placeholders until captures of a built release exist.

**Help and offline docs** (`Help.dc.html`, 1440 wide, fills, interactive)

- Shows: Help inside the app: a hero offering a guided tour of the current page, tours as cards with progress rings that remember where you stopped, keyboard shortcuts as key caps, the offline documentation with its freshness, and a what-changed strip for the installed version.
- Try: Start a tour, the tour progress cards, the shortcut scheme buttons, Read aloud switch, Tweaks > lang, dark, motion calm.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Tour rings draw; cards cascade in; the Start action has a rotating conic border; a wavy ring rotates round the tour progress.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the help text every catalogue entry carries (shown beside each control).
- Still unbuilt in the real app: Guided tours, shortcuts sheet and bundled offline docs are design only.

### Phone boards: where every desktop feature lands (page id `phone`)

**Phone: home** (`Phone.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Phone home: the same dashboard folded to one column. A hero with the live rate and a traffic line, two half-width number tiles, quick switches as large rows, and the bottom navigation with a sliding pill.
- Try: the quick switches, Tweaks > stage (loading skeleton, empty, failure), lang, dark, role viewer.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The rate counts up over an aurora; the traffic line draws with a sweep; tiles arrive in sequence; the navigation pill springs in.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the overview screen at phone width.
- Still unbuilt in the real app: Live rate, quick switches and the bottom navigation are design only.

**Phone: Wi-Fi with pending sheet** (`PhoneWifi.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Phone Wi-Fi: the band tiles become a swipe-free stack, each with its radio switch and a gauge; width and power are thumb-size controls; pending changes collect in a bottom sheet that rises over the page with Preview and Apply.
- Try: flip a radio or change the width: the bottom sheet rises with the count; Discard; Tweaks > stage success and failure, role viewer.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The sheet springs up from the bottom edge; gauges draw; the Apply action has a rotating conic border.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the Wi-Fi band settings at phone width.
- Still unbuilt in the real app: The bottom sheet and gauges are design only.

**Phone: navigation and search** (`PhoneNav.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Where every desktop destination lands on a phone: a search button with the regex button beside it, area chips, and all areas as a two-column grid of shaped icon tiles, so nothing from the desktop rail is lost.
- Try: the area chips, Tweaks > firmware stock (VPN Director shows its lock), lang, dark, stage empty.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Icon tiles cascade in and their shapes turn on hover; the navigation pill springs.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the app navigation list.
- Still unbuilt in the real app: Search, pinning and the grid are design only.

**Phone: devices and device sheet** (`PhoneDevices.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Phone devices: device rows with icon tiles and status chips, and the device sheet that rises from the bottom with the same actions as the desktop panel (block, reserve, priority) as thumb-size controls.
- Try: the sheet switch in the app bar area (Device sheet), block and reserve switches, priority buttons, Tweaks > role viewer, stage.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The sheet springs up with a scrim fade; the newest device has a pulsing chip; rows cascade.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the devices screen at phone width.
- Still unbuilt in the real app: The device sheet is design only.

**Phone: connection guard** (`PhoneGuard.dc.html`, 390 by 844, fixed root, interactive)

- Shows: The guard takeover on a phone: the whole screen is the question. A real countdown inside a rotating wavy ring, one full-width confirm action in the thumb zone, a quieter roll-back action and what will be restored.
- Try: I am still connected (success), Roll back now (failure), Tweaks > stage, motion calm (the ring stills, the number stays), lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: A wavy ring rotates round a number that counts down; aurora behind it; the confirm action has a rotating conic border; success bursts with a drawn tick; failure shakes with a red pulse.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the connection-loss guard, at phone width.
- Still unbuilt in the real app: The wavy ring; the guard logic exists.

**Phone: tools** (`PhoneTools.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Phone tools: the tool picker as a segmented control, a result hero with the average and a latency line, target chips, and the live log as a short terminal.
- Try: the tool buttons, target chips, Run (success), Tweaks > stage failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The latency line draws in; log lines arrive one by one; the Run action has a rotating conic border.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: ping, traceroute and lookup run on the router.
- Still unbuilt in the real app: The latency line and live log are design only.

**Phone: first run** (`PhoneSetup.dc.html`, 390 by 844, fixed root, interactive)

- Shows: First run on a phone: a radar finds the router, the five steps are a compact pipeline, the sign-in method is two thumb-size buttons, and the single Next action sits in the thumb zone.
- Try: the sign-in buttons, the reveal eye, Next (success), Tweaks > stage loading, empty and failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: A radar sweeps with blips; the current step rotates; Next has a rotating conic border; success bursts; failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the first-run screens at phone width.
- Still unbuilt in the real app: The scan radar is design only.

**Phone: settings and notifications** (`PhoneSettings.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Phone settings: the four notifications that need you as a stack, then look, language and motion as thumb-size segmented controls, and the app lock switch.
- Try: the language, theme and motion buttons (they mirror the Tweaks), the lock switch, Tweaks > lang, dark, motion.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Toasts fly in in sequence; segmented indicators slide with a spring.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the language and theme choices the app stores.
- Still unbuilt in the real app: The notification stack and motion choice are design only.

### Shared shell components (page id `components`)

**Navigation rail (shared component)** (`Rail.dc.html`, 272 px wide component, interactive)

- Shows: The frosted navigation rail every desktop board imports: brand mark in a cookie shape, the Review changes action with its pending count, and every area grouped as Network, Visual editors, Router and App.
- Try: Tweaks > page (any id such as wifi, edmap, history) to move the active pill, pending (0 hides the badge and stops the rotating border), firmware stock (VPN Director shows Merlin only), lang, dark, accent, motion.
- Tweaks: accent, dark, motion, firmware, role, lang, plus its content props.
- Dramatic motion: A conic-gradient border rotates round Review changes while changes are pending.
- Normal motion: Items shift and tint on hover; the active marker grows in.
- Stands for: the app navigation list in the left column.
- Still unbuilt in the real app: The Visual editors group and One-click modes entries do not exist in the app yet.

**Top bar (shared component)** (`TopBar.dc.html`, 1168 px wide component, interactive)

- Shows: The top bar every desktop board imports: a large condensed page title, the search-everything button (a button that opens the palette, not a text box), firmware chip, language, notifications with an unread badge, the signed-in person, and the page tabs.
- Try: click the tabs (the indicator springs across), Tweaks > title, tabs (comma separated), active, role, firmware, lang, dark.
- Tweaks: accent, dark, motion, firmware, role, lang, plus its content props.
- Dramatic motion: None; this component only carries normal motion.
- Normal motion: The tab indicator travels with a spring; icon buttons morph from circle to squircle on hover.
- Stands for: the app header.
- Still unbuilt in the real app: The search palette and per-page tabs are design only.

## What the real app has today

The app in `public/` and `server/` has: first-run owner account, connect and host key approval; overview; devices; a settings catalogue rendered as switches, selects, sliders, number, IPv4, host name and password fields across Wi-Fi, internet, local network, firewall, port forwarding, parental controls, traffic priority, VPN and USB; logs; ping, traceroute and name lookup run on the router; the read-only scheduled jobs table; the advanced table; change history with undo; and the write path (preview, connection-loss guard for network changes, two-key confirmation for destructive actions).

Everything else on the canvas is design only, as stated per board above. The largest unbuilt pieces, in the order they would unlock the most:

1. The bento and hero layout system, glass, shapes and the motion set in `theme.css` (the app has its own simpler stylesheet).
2. The richer controls: IPv4 picker with stepper, prefix bar, port picker with presets, device picker, paintable grid, segmented indicator.
3. One-click modes and the mode builder (they reuse the existing write path for several settings at once).
4. The eight visual editors.
5. Live data visuals: traffic chart, network map, heat maps, gauges.
6. App-side areas: notifications centre, tabs, appearance and motion editor, language tone, app modes, locks and roles, regex builder, updates, toolbox, server manager, deploy assistant.

## How the canvas was checked

- `node gen.mjs` writes every file, then runs a small stand-in for the canvas runtime over every board: every value hole must resolve in the default Tweaks, in Cantonese + dark + stock firmware + viewer + calm, and in each of the other four stages; tags must balance; every handler is called once from a fresh state and the board re-rendered; and every file is scanned for the repository rules (no private-range IPv4, no forbidden word, no account prefix before an address, no long dash, no machine path, no bare input).
- Each board was pre-rendered to static HTML with `theme.css`, opened in headless Microsoft Edge at its board size, and captured in the default Tweaks and in calm + dark + Cantonese + stock + viewer. Hero boards were captured twice 600 ms apart to confirm that things move. The captures were looked at and the boards corrected.

## Known gaps in the canvas itself

- The boards were verified with a stand-in for the runtime, not inside the live canvas. `support.js` is not in the repository, so behaviour that depends on the real runtime (keeping DOM nodes between renders so that position transitions play, `onInput` on range sliders) was not observed there.
- Board heights in `canvas.json` were measured from the static pre-render in a desktop browser. Desktop boards use `expand: fill`, so a difference only changes the empty space under a board.
- The rail is long (five groups). It collapses the Visual editors group to one entry outside the editors, and the Router group to one entry inside them, so that no board is much shorter than its rail.
- A drag is pick-then-place (two clicks) on every editor.
- Paint-grid cells are 30 px tall and the address-map cells are smaller still, below the 44 px target size. Both have full-size routes beside them: presets and steppers.
- Count-up numbers are drawn with a CSS counter. Each carries an `aria-label` with the value, but the figure is not selectable text.
- The regex builder is far from parity with a dedicated regex tool; the board lists what is missing.
- Captures on the documentation website board are placeholders until real captures of a built release exist.
- Glass panels rely on `backdrop-filter`, colour roles on relative `oklch()` colours, counters on `@property`, and packets on `offset-path`. All four need a current Chromium, which both delivery forms of the app use.
