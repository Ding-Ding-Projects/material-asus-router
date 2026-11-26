# Material Asus Router: design handoff

This folder holds the design canvas for Material Asus Router, a self-hosted web app and Windows desktop app that manages an Asus router (stock ASUS or Asuswrt-Merlin) over SSH.

- `design/canvas/project` is the canvas project: 85 boards (83 screens plus the two shared shell components), `theme.css` and `canvas.json`.
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

## Added in the second pass

Twenty-one boards on eleven new pages, written by three new generator files (`boards6.mjs`, `boards7.mjs`, `boards8.mjs`) and a second theme part (`theme2.mjs`). Every one carries the same six Tweaks plus `stage`, has its sticky note, and sits on a category page with a title note.

- **SSH** (page `ssh`): the SSH action catalogue, the owner terminal, Entware and add-ons, the read-only flash backup.
- **Firmware upload** (page `fwup`): the upload with the dim sum moment, and the screen that shows only the words "Hong Kong Dim Sum".
- **Live and history** (page `live`): Live mode with the undo toast, and the History manager (timeline, diff, compare, per-setting history, restore, statistics, a before-and-after simulation panel).
- **Dangerous actions** (page `danger`): the four-key confirmation, the Level 3 "Prepare for brother mad" full-screen warning, the reboot launch sequence and the live reboot timeline.
- **Household** (page `household`): the household screen (Your brother, painted protected hours, Home Assistant, the presence chip, Most brother madness allowed) and the "Who's using the most" leaderboard. The leaderboard has a second tab, "Who's uploading or downloading the most", which ranks the two directions separately.
- **Diagnostics and services** (pages `wdiag`, `hardware`, `services`, `fwint`, `guest`, `dsl`): Wi-Fi diagnostics, ports and hardware, network services and web access, cloud, firewall internals, Guest Pro with the captive portal, and DSL.

The rail gained three groups (Owner tools, Household, Diagnostics and services) and two App entries (Live mode, History manager). New shared parts in `theme2.mjs`: full-board takeovers, the launch scene, key locks, vertical and horizontal timelines, the bamboo steamer, undo toasts with a draining bar, the podium and ranked rows, in-board tabs, the back panel, chain boxes, the phone preview and tone bars. It also fixes the pipeline connector, which an unrelated phone rule was padding.

The idea of a "brother level" runs through these boards: every action gets a level from 0 to 3, worked out from who is online and what they are doing. The Cantonese strings call the person 阿哥; the household screen lets the owner rename him.

## Added in the fourth round

Six boards for screens the app already has, written by one new generator file (`boards9.mjs`) and a third theme part (`theme3.mjs`). All six are drawn at phone width (390 by 844) because that is where these screens are hardest to get right, and every one also reads at 360 px wide with nothing sticking out: buttons and tags wrap, rows fold their actions onto a second line, and long content scrolls inside the frame.

- **Kick and ban** (page `kick`): the card for the person who was paused, the Paused now list, the device list with its Kick buttons, the Kick sheet (impact, three ways to pause, the pointer to the speed limiter, durations up to a ban, a note) and the Recent log.
- **The Unkick page** (page `kick`): the public page with no sign-in, with its paused, banned, not paused, unknown device and lifted states.
- **Lock IP** (page `devices`): one-tap Lock IP and Unlock IP on the device list, the "IP locked" tag in words, lock to a different address, the selection bar, and the changes panel with the four-key confirmation. Key 4 has its touch form: "No keyboard? Tap in order:" with the buttons 3, 1, 2.
- **Saved routers** (page `routers`): the router in use, the Main or Testing choice, the saved list, the "Testing router" badge that sits on the top bar, and the key choices on the connect screen with the passphrase refusal.
- **Start-up** (page `setup`): the loading card with its feature count and the start-up error card.
- **Router add-on page** (page `addon`): the page the add-on adds to the router's own web interface, drawn in the router's style and not in the app's.

Three of them are not screens of the signed-in app (the Unkick page, Start-up and the router add-on page), so they carry no app bar and no bottom bar (`bare` in the board specification) and they preview their states with their own switcher instead of the `stage` Tweak.

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

`stage` is on 80 of the 83 screen boards. It is not on the two shell components, which have no stages, nor on the Unkick page, Start-up and the router add-on page, which preview their own states with a switcher on the board. The shell components add their own content props: `page` and `pending` on the rail; `title`, `tabs` and `active` on the top bar.

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
- skeleton shimmer while loading;
- the Level 3 warning: the headline slams in, the screen shakes, hazard stripes scroll, a yellow frame breathes and an angry face shakes with steam;
- the reboot launch: stars twinkle, the engine flickers, smoke billows, the count runs down from ten, and at lift-off the rocket climbs while the tower swings away and the scene shakes;
- the dim sum moment: the steamer lid lifts and settles, steam drifts up, buns pop in and bob as stages finish;
- keys that rotate a quarter turn in their locks, a timeline head that travels, a podium that grows from the floor, undo toasts whose bar drains.

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

Every board is interactive: all 2 300 or so handlers are wired to board state, and the generator operates each one and re-renders the board as a check. The boards with their own logic beyond the shared controls:

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

- **SSH action catalogue**: filter by kind, open an action, run it or be sent to the four keys.
- **Owner terminal**: one-tap commands append real-looking output; a restart is stopped; owner role only.
- **Read-only flash backup**: copy part by part; the flash strip and checksums follow.
- **Firmware upload**: five steps driven by the hero action, ending in the dim sum moment.
- **Hong Kong Dim Sum only screen**: click the screen to lift it; show it again.
- **Live mode**: flip a switch for an undo toast, or turn Live mode off and watch the change queue instead.
- **History manager**: select, compare two points, restore, per-setting trail, simulation side.
- **Four-key confirmation**: a switch, a pick, a dial and a final turn, with wrong answers handled.
- **Level 3 warning**: preview each level; lift and show the takeover.
- **Reboot launch sequence**: start, launch, abort, reset.
- **Live reboot timeline**: step through the seven stages.
- **Household**: presence states and the allowed level.
- **Who's using the most**: two tabs, direction, period, slow down a device.
- **Ports and hardware**, **Firewall internals**, **Guest Pro**: pick a socket, pick a chain, design the portal with a live phone preview.
- **Kick and ban**: open the sheet from a device, choose how and for how long, kick, ban or disconnect; lift a pause; the log follows.
- **The Unkick page**: every state, and the lift.
- **Lock IP**: lock, unlock, lock to another address, select several, and turn the four keys including the tap-in-order form of key 4.
- **Saved routers**: switch router, rename, Main or Testing, remove, and the three key choices.
- **Start-up** and **Router add-on page**: loading and error; on and off, port, version.

A drag is two clicks on the canvas (pick, then place) because the canvas runtime exposes click handlers. The app should offer pointer drag and keep the two-click route as the keyboard and switch-access path.

## Pages and boards

### Setup, onboarding and start-up (page id `setup`)

**First run** (`Setup.dc.html`, 1440 wide, fills, interactive)

- Shows: First-run wizard as one stage, not a form: a five-step pipeline, a radar that sweeps the network for the router, the found router as a glass card, sign-in method as segmented buttons with an app key (default) or the router password, the host key as a fingerprint grid to approve, firmware detection and the look step.
- Try: the step buttons (Back and Next move the pipeline), App key or Password, the reveal eye, Approve host key, Tweaks > stage success (burst and tick) and failure (shake and reason), firmware, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Aurora behind the hero; a radar sweep with blips while the network is scanned; the current step badge is a rotating cookie; success bursts shapes and draws a tick; failure shakes with a red pulse and the reason slides in; the Next action has a rotating conic border.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the app first-run screens: owner account, connect, host key approval.
- Still unbuilt in the real app: Network scan radar, firmware detection summary and the look step are design only.

**Start-up: loading and the start-up error** (`Startup.dc.html`, 390 by 844, fixed root, interactive)

- Shows: The two cards a person can see between signing in and the app being ready. The loading card: "Opening your router", a spinner, a progress bar and the count "Loading features: 120 of 182", so a slow start is visibly still moving. The start-up error card: "The app could not start", the error text in a monospace box so it can be copied into a report, and two ways out, "Clear saved settings and retry" and "Try again".
- Try: the two state buttons (Loading, Could not start); the slider under the loading card (the bar and the count follow); Try again and Clear saved settings and retry (both go back to loading from zero; the second one says what was cleared); Tweaks > motion calm (the spinner stops and the count still tells you where it is), lang, dark, accent.
- Tweaks: accent, dark, motion, firmware, role, lang.
- Dramatic motion: The error card shakes once when it appears.
- Normal motion: The spinner turns; the progress bar grows with a spring and shimmers; the card rises in.
- Stands for: the loading card and the start-up error card the app shows after sign-in.
- Still unbuilt in the real app: Nothing on this board is missing from the app. The slider is for the canvas only.

### Saved routers and connection keys (page id `routers`)

**Saved routers and connection keys** (`Routers.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Saved routers at phone width. At the top, the badge that sits on the top bar of the whole app for as long as a Testing router is in use ("Testing router: Bench"), so a change meant for the bench is never made at home by mistake. "The router in use" card with a name field, a Main or Testing choice and Save. The list of saved routers with Main and Testing chips, "In use" on the current one, "Use this router" on the others, and remove. The second section is the key choice on the connect screen: Create a key, Make a new key (asks first) and Use a key I already have, with the refusal for a key that is protected by a passphrase.
- Try: Use this router on Home (the Testing badge leaves); switch the router in use between Main and Testing and Save (the chip and the badge follow); type a new name and Save; remove a router that is not in use; the Connection keys section: each of the three choices, Make a new key then Cancel or confirm, and the two sample key files (the one with a passphrase is refused with the reason); Tweaks > role viewer, lang, dark, stage.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The dot on the Testing badge pulses for as long as a Testing router is in use.
- Normal motion: The badge pops in and out; the Main or Testing indicator slides; rows cascade in; option cards change shape when chosen; the question and the refusal pop in.
- Stands for: the saved routers screen, the Testing badge on the top bar and the key choices on the connect screen.
- Still unbuilt in the real app: Nothing on this board is missing from the app. The two sample key files stand in for the file chooser.

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

### Devices and Lock IP (page id `devices`)

**Devices** (`Devices.dc.html`, 1440 wide, fills, interactive)

- Shows: Everyone on the network as cards in a bento, not a table: a hero with the device count and a band split, each device with an icon tile, signal bars, live rate sparkline, status chip and inline switches for block and reserve; a focused device panel with priority, owner and address pickers.
- Try: the filter chips, block and reserve switches on any row (the dock counts them), the focused device picker, priority buttons and the last-octet address stepper, Tweaks > role viewer, stage empty and failure.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The device count counts up over an aurora; the newest device has a pulsing ring; sparklines draw in; failure shakes and names the clashing reservation.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the app devices screen (name, address, MAC, band).
- Still unbuilt in the real app: Signal history, per-device live rate, owner assignment and bulk actions are design only.

**Lock IP on the device list** (`LockIp.dc.html`, 390 by 844, fixed root, interactive)

- Shows: Lock IP on the device list at phone width. Each row has a one-tap Lock IP or Unlock IP button, the words "IP locked" as a tag beside the address (not a colour alone), an icon button to lock the device to a different address, and a Kick shortcut. Ticking rows brings up the selection bar with Lock IPs and Unlock IPs. Docked at the bottom of the list is the waiting change, written out ("Lock IP 198.51.100.103 → kitchen-speaker"), with Review. Review opens the Changes waiting section: the changes panel and the four-key confirmation. Key 4 offers "No keyboard? Tap in order:" with the buttons 3, 1, 2, which is the touch form of the key combination.
- Try: Lock IP on Living-TV (the docked line counts a second change); Unlock IP on Pat-Laptop; the pencil on a row (an address stepper opens; Lock to this address queues it); tick and untick rows, then Lock IPs or Unlock IPs in the selection bar; Review, or the Changes waiting section button; in the panel turn key 1, type kitchen-speaker for key 2, tap Press and hold for key 3, then tap 1, 2, 3 in order for key 4 (the buttons are laid out 3, 1, 2, and a wrong tap starts again); Turn all four keys; Discard; Tweaks > role viewer, stage success and failure, lang, dark.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: When all four keys are on, the Turn all four keys button gets a rotating conic border.
- Normal motion: Rows cascade in; the selection bar and the address editor pop in; each key card turns green and its mark spins once when the key is on; tapped numbers turn green.
- Stands for: the device list with Lock IP, the pending changes panel and the four-key confirmation, as the app shows them on a phone.
- Still unbuilt in the real app: Nothing on this board is missing from the app. In the app key 3 is a real press and hold; on this board one tap stands in for it.

### Kick, ban and the public Unkick page (page id `kick`)

**Kick and ban** (`KickBan.dc.html`, 390 by 844, fixed root, interactive)

- Shows: The Kick and ban screen at phone width. A card for the person who was paused, with the link to the Unkick page. A Paused now list where each row says how the device is held, until when ("until 19:49, 30 min left"), who did it and the note, with an Unkick or Unban button. The device list, each row with its owner ("belongs to Your brother") and a Kick button. The Kick sheet: the impact line, the three ways to pause with an explanation under each, a dashed box that points to the speed limiter instead, the duration choices from 15 minutes to "Until lifted (ban)", a note for the person, and one action that reads Kick, Ban or Disconnect. A Recent log.
- Try: the three section buttons (Paused now, Devices, Recent); Unkick on Living-TV and Unban on Alex-Tablet (the row leaves and the log gains a line); Kick on Game-Console (the impact line turns into the brother warning and shakes once); in the sheet pick each way to pause (Disconnect hides the duration and renames the action), pick "Until lifted (ban)" (the action becomes Ban and the ban note appears), then Kick (the device moves to Paused now); Copy the link; Tweaks > role viewer (nothing can be kicked), motion standard (the warning stops shaking), lang, dark, stage.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The brother warning in the Kick sheet shakes once when it appears.
- Normal motion: The sheet springs up over a scrim; rows cascade in; the section indicator slides; chips and option cards change shape when chosen; the result line pops in.
- Stands for: the Kick and ban screen in the app, including the sheet opened from the device list.
- Still unbuilt in the real app: Nothing on this board is missing from the app. The brother wording follows the household setting, which this board fixes to one name.

**The Unkick page (public, no sign-in)** (`Unkick.dc.html`, 390 by 844, fixed root, interactive)

- Shows: The public Unkick page, which needs no sign-in: the page a paused person opens on their own device. A breathing circle, "Your internet is paused", why and the note that was left, "until 19:49 (30 min left), by Pat", and one big "Unkick me" button (it reads "Unban me" for a ban). Under it, the line that says the page can only lift a pause on the device you are using now and never shows anyone else's devices. The other states are here too: not paused, the router does not know this device, and lifted ("Unkicked. You are back online.").
- Try: the five state buttons (Paused, Banned, Not paused, Unknown, Lifted); Unkick me (the circle turns into a green tick and the title changes); Check again; Tweaks > lang (the page follows the language of the browser), dark, accent, motion standard and calm (the circle stops breathing).
- Tweaks: accent, dark, motion, firmware, role, lang.
- Dramatic motion: The circle breathes and sends out two slow rings while the device is paused; the green tick pops in when the pause is lifted.
- Normal motion: The card rises in; the button lifts on hover and presses in.
- Stands for: the Unkick page the app serves without sign-in, opened from the link on the Kick and ban screen.
- Still unbuilt in the real app: Nothing on this board is missing from the app. The state buttons at the top are for the canvas only.

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

### App updates and the updater service (page id `updates`)

**App updates (owner only, Docker-hosted app)** (`AppUpdate.dc.html`, 390 by 844, fixed root, interactive)

- Shows: App updates for the Docker-hosted app at phone width, for the owner only. A header card with the running version ("0.1.0 · sha-8e0f4ba7cb53 · built 2026-11-25 20:10"), the newest version ("sha-1a2b3c4d5e6f (built 21:05)") and an "Update available" tag, or "You are up to date". Two buttons, Check for updates and Update now. While updating, a list of four steps that tick off: Downloading the new version, Starting it, Waiting for it to answer (up to 90 seconds), Done: now running the new image; with the line that accounts, router settings and change history are kept. The rollback state marks the step that failed, says the previous version was put back and nothing else changed, and offers Try again. "Update automatically every night" with a time choice (02:00, 03:00, 04:00) and the health-check line. The "Updater not set up" card with the compose command for the updater service. A Recent updates list.
- Try: Check for updates; Update now, then "Finish this step" three times (each step turns green; the last one names the new image and the tag becomes "You are up to date"); turn off "The new version answers" in the dashed canvas box and update again (the waiting step turns red and shakes once, the previous version is named as still running, Try again appears); turn off "Updater service installed" (the set-up card with the command appears, Update now and the night switch are off); Copy the command; the night switch and the three times; Start again; Tweaks > stage empty (updater not set up), success (updated) and failure (rolled back), role operator or viewer (only the owner can update), motion standard and calm, lang, dark, accent.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The failed step shakes once when the new version does not answer; the Update now button has a rotating border while an update is available.
- Normal motion: Step marks pop to a green tick one after another and the current step shows a small spinner; the tag, the checked line and the set-up card pop in; the time indicator slides; rows cascade in. With motion calm or reduced motion the spinner stops and the state words (Done, In progress, Waiting) still say where it is.
- Stands for: an App updates screen in the app settings and the updater service started with compose.update.yaml.
- Still unbuilt in the real app: All of it when this board was drawn: the app has no self-update screen and compose.update.yaml is not in the repository yet. In the app the steps tick off as the updater reports them; on this board "Finish this step" stands in for each report. The dashed box is for the canvas only.

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

### SSH action catalogue, owner terminal, Entware, flash backup (page id `ssh`)

**SSH action catalogue** (`SshActions.dc.html`, 1440 wide, fills, interactive)

- Shows: Every action the app can run on the router over SSH, as cards sorted into four lanes by how much confirmation each one needs: runs at once, preview first, preview and guard, four keys. A filter by kind, the exact command on every card, and a sheet that states what the command does, how it is confirmed, the brother level it carries and whether it can be undone.
- Try: the kind filter chips (lanes refill), click any card (the sheet rises with the exact command), Run it (a toast confirms), open Restart the router (it sends you to the four keys instead of running), Tweaks > role viewer and operator, stage failure, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Cards cascade into their lanes; the sheet rises with a scrim fade; the four-key lane has a rotating conic border on its action; the run toast bursts shapes and draws a tick; failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the SSH command runner and the write path that already exist; the app already runs nvram, service and log commands.
- Still unbuilt in the real app: The catalogue as one browsable list, the four lanes, the per-action sheet and the brother level per action are design only.

**Owner terminal** (`Terminal.dc.html`, 1440 wide, fills, interactive)

- Shows: A real shell on the router, for the owner role only: a large terminal with the session so far, one-tap commands that type and run themselves, a stop that catches dangerous commands and hands them to the four keys, session recording, an idle lock and a paste guard. Operators and viewers see a locked card with the reason.
- Try: the one-tap commands (output is appended with a live cursor), Try to reboot (the app stops it), Clear, the recording switch, the idle slider, Tweaks > role operator (the terminal locks), firmware, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Output lines arrive one by one with a blinking cursor; the stopped-command strip shakes with a red pulse; the hero action has a rotating conic border.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the SSH connection the app already holds; today it only runs catalogue commands.
- Still unbuilt in the real app: The free terminal, the dangerous-command stop, recording, the idle lock and the paste guard are design only.

**Entware and add-ons** (`Entware.dc.html`, 1440 wide, fills, interactive)

- Shows: Extra software for Asuswrt-Merlin, kept on a USB drive: Entware health and space, a package shelf with install toggles, the well-known Merlin add-ons as cards with switches, updates waiting, the custom-script switches and the live package log. On stock firmware every tile shows locked with the reason.
- Try: the package chips (each queues an install into pending changes), the add-on switches, Update all (success), Tweaks > firmware stock (tiles lock with the reason), stage empty and failure, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Package tiles arrive staggered; the space gauge draws; log lines arrive one by one with a blinking cursor; Update all has a rotating conic border; success bursts and failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: nothing yet. The router side is plain SSH: opkg and the add-on installer scripts.
- Still unbuilt in the real app: The whole area is design only: Entware setup, the package shelf, add-on cards and script switches.

**Read-only flash backup** (`FlashBackup.dc.html`, 1440 wide, fills, interactive)

- Shows: A byte-for-byte copy of the router flash, read over SSH and never written: the flash as a proportional strip of its six parts, each part as a timeline row with its size, what it holds and its checksum once verified, the copy rate, where the copy is kept and what it is for.
- Try: Copy the next part (the strip fills, the row turns green and its checksum appears), Start again, Tweaks > stage success and failure, role viewer, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The flash strip fills part by part with a shimmer on the part being read; the current row pulses; the percentage counts up; success bursts and failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the SSH connection; the app already reads files from the router.
- Still unbuilt in the real app: Reading the flash parts, the double-read check and the kept-copies list are design only.

### Firmware upload, the dim sum moment and the three-word screen (page id `fwup`)

**Firmware upload** (`FirmwareUpload.dc.html`, 1440 wide, fills, interactive)

- Shows: Uploading a firmware file by hand, as five steps you can see: choose the file (a drop zone that is also a button), five checks that all must pass, the four keys, then the dim sum moment: while the router writes the image and restarts there is nothing useful to press, so the screen says so with a bamboo steamer, rising steam and five buns that fill in as the stages finish. Then the router is back.
- Try: Start over, Choose the file, Run the five checks, Write it (the dim sum moment appears), The router is back; Try a file for another model (it opens the screen that shows three words); Tweaks > motion calm (steam stops, buns rest in place), stage success and failure, role viewer, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The dim sum moment: the steamer lid lifts and settles, steam drifts up, buns pop in and bob as each stage completes, a wavy ring rotates round the minutes left. The current step is a rotating cookie; the hero action has a rotating conic border; success bursts and failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the firmware domain: installed version and check-for-update.
- Still unbuilt in the real app: Manual upload, the five checks, the dim sum moment and the back-online check are design only.

**Hong Kong Dim Sum only screen** (`DimSumOnly.dc.html`, 1440 wide, fills, interactive)

- Shows: The refusal screen. When a firmware file is for another model, or its signature has been changed, the whole app is replaced by one screen that says "Hong Kong Dim Sum" and nothing else: no reason, no alternative, no button. Under it (click anywhere, or change the stage Tweak) is the ordinary record of what was refused and proof that the router was not touched.
- Try: click anywhere on the screen (it lifts and the record underneath shows), Show the screen again, Tweaks > stage (loading, empty, success and failure show the record page), motion calm (the steam stops), dark, accent, lang (the three words do not change).
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The three words rise in with a glow; steam drifts up behind them; lifting the screen fades it out. Nothing else moves, on purpose.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: nothing yet.
- Still unbuilt in the real app: The whole refusal screen and the refusal record are design only.

### Live mode and the History manager (page id `live`)

**Live mode** (`LiveMode.dc.html`, 1440 wide, fills, interactive)

- Shows: Live mode: an app-wide switch that writes each small change the moment you make it instead of collecting it for Apply. A hero with the big Live switch, six everyday switches to try it on, the undo toast with its eight-second bar, what is never live (anything that can cut the connection, anything with keys), a live feed and how long Live mode stays on.
- Try: flip any of the six switches (a toast slides in with Undo and a draining bar; the row gets a live mark), Undo on the toast, Keep, turn Live mode off and flip again (the change waits in the pending dock instead), Tweaks > role viewer, motion calm, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Toasts fly in from the right and their bar drains over eight seconds; the Live dot pulses; the hero number counts up; the Live switch has a rotating conic border while on.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the write path: today every change is previewed and applied on request.
- Still unbuilt in the real app: Live mode, the undo toast and the never-live list are design only.

**History manager** (`HistoryManager.dc.html`, 1440 wide, fills, interactive)

- Shows: Everything the router has ever been told, as something you can work with: a timeline you can select from, a before-and-after diff of one change or of everything between two points, the life of one setting across months, restore to any point, statistics (who, what, when, how often undone) and a simulation panel that shows what a restore would do to the house before you run it.
- Try: click a timeline entry (the diff follows), Compare with... then a second entry (the diff becomes everything between them), Clear, Restore to just before this (a banner confirms), the per-setting buttons (the value trail changes), Now and After restore in the simulation panel, Tweaks > role viewer, stage failure, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Timeline entries cascade in and the selected one grows its marker; diff rows slide in one after another; bars and the undo gauge draw; the restore action has a rotating conic border; the restore banner bursts shapes and draws a tick.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the app change history with undo for single entries.
- Still unbuilt in the real app: Compare between two points, per-setting history, restore to a point, statistics and the simulation panel are design only.

### Four keys, the Level 3 warning, the reboot launch and its live timeline (page id `danger`)

**Four-key confirmation** (`FourKey.dc.html`, 1440 wide, fills, interactive)

- Shows: The confirmation for actions that cannot be undone (restart, firmware, factory reset): four keys in a row, each a different real control so that no single slip or habit gets through. Key 1 is a switch saying you know what will happen, key 2 is picking this router out of three, key 3 is setting a dial to the number shown, key 4 only turns after the other three. An arming bar fills as they turn, and the launch pad opens only when all four are on.
- Try: turn key 1 off and on, pick a wrong router (key 2 goes back and says so), step the dial to 7 (key 3 turns), then Turn the last key (the bar fills and the launch pad opens), Pull all keys; Tweaks > role operator (owner only: the keys lock), stage success and failure, motion calm, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Each key rotates a quarter turn in its lock and its card lifts and turns green; the next key to turn pulses; the arming bar grows through green, amber and red; the open launch pad action has a rotating conic border.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the two-key confirmation for destructive actions that the app already has.
- Still unbuilt in the real app: Four keys, the three different key controls, the arming bar and the expiry are design only.

**Level 3: Prepare for brother mad** (`BrotherMad.dc.html`, 1440 wide, fills, interactive)

- Shows: The full-screen Level 3 warning, "Prepare for brother mad", which takes over the whole app when an action would cut someone off for minutes in the middle of something that matters: hazard stripes, an angry face that shakes and steams, exactly what he is doing and what he will lose, and three ways on (wait until he is done, warn him first, or accept it and go to the four keys). Under it: the four levels as cards and what decides the level.
- Try: Wait until he is done (the warning lifts), Show the Level 3 warning again, the four level cards (the meter and the wording follow; only Level 3 has the takeover), I accept (goes to the four keys), Tweaks > motion standard and calm (stripes, shaking and steam stop), dark, accent, lang, stage.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The warning slams in and the screen shakes three times; hazard stripes scroll; a yellow frame breathes; the face shakes with steam puffing from both sides; the lines below rise in one after another; the top bar of the meter flickers like a flame.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: nothing yet. The app knows which devices are online; it does not yet know what they are doing.
- Still unbuilt in the real app: Levels, activity detection and the full-screen warning are design only.

**Reboot missile launch sequence** (`MissileLaunch.dc.html`, 1440 wide, fills, interactive)

- Shows: Restarting the router, staged as a launch so that it is impossible to do absent-mindedly: a night-sky launch pad with the rocket on it, a go or hold checklist, a ten-second count with Abort in reach the whole time, lift-off when the command is really sent, and then a hand-over to the live reboot timeline. Below: the sequence, what is actually sent, abort rules and how to switch the show off.
- Try: Abort (the pad says nothing was sent), Reset, Start the count (flames and smoke start, the count runs), Launch now (lift-off: the rocket climbs, the tower falls away, the scene shakes), Watch the reboot live; Tweaks > motion calm (a still pad with a plain 10), role operator (owner only), stage success and failure, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Stars twinkle; during the count the engine flickers, smoke billows and the rocket trembles while the number counts down from ten; at lift-off the flame triples, the rocket climbs, the tower swings away and the whole scene shakes; the launch action has a rotating conic border.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the reboot command behind the two-key confirmation.
- Still unbuilt in the real app: The launch pad, the checklist, the count with abort and the hand-over to the timeline are design only.

**Live reboot timeline** (`RebootTimeline.dc.html`, 1440 wide, fills, interactive)

- Shows: What happens after lift-off, live: a hero with the elapsed time and a seven-point timeline whose marker travels as each stage is seen (command sent, SSH closed, radios down, system starting, internet up, Wi-Fi up, devices back), a ping strip that turns red while the router is silent, each stage with its expected and actual time, the devices rejoining one by one, how the brother level cools as things return, and what the app does if the router does not come back.
- Try: Next stage (the marker travels, the ping strip grows, devices turn green, the level cools), Replay from the start, Tweaks > stage success and failure (not back after 5 minutes), motion calm, role viewer (can watch), lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The timeline head pulses and travels with a spring; stage markers pop in and the current one grows; ping bars rise one by one; the current stage row pulses; the elapsed number counts; the meter bar flickers while the level is high.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: nothing yet: today the app simply loses its connection during a restart.
- Still unbuilt in the real app: Listening for the router during a restart, the timeline, the ping strip and the rejoin list are design only.

### Household and who is using the most (page id `household`)

**Household** (`Household.dc.html`, 1440 wide, fills, interactive)

- Shows: The people behind the devices. A hero card for "Your brother" with his presence chip and what he is doing right now, a tile for his name, devices and notices, "Most brother madness allowed" as a four-step control with a meter and a plain sentence for each step, protected hours painted on a week grid, the Home Assistant connection with entity pickers, the presence chip in its four states and everyone else in the house.
- Try: the four presence states (the chip, the sentence and the level meter follow), Most brother madness allowed 0 to 3 (the sentence changes and the change queues), paint protected hours (click one cell then another), the presets, the device chips, the Home Assistant entity picker and switches, Tweaks > role viewer, stage failure, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The brother avatar is a morphing shape; the presence chip pulses while live; the meter bars grow and the top one flickers like a flame at Level 3; grid cells pop as they are painted; tiles arrive staggered.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the device list with names.
- Still unbuilt in the real app: People, the brother card, the allowed level, protected hours, the Home Assistant link and the presence chip are design only.

**Who's using the most** (`Leaderboard.dc.html`, 1440 wide, fills, interactive)

- Shows: A leaderboard of who is using the connection, with two tabs. "Who's using the most" ranks devices by download plus upload on a podium and a bar list. "Who's uploading or downloading the most" splits the two directions: a Downloading or Uploading switch re-ranks the podium, and two lists sit side by side, because the device that uploads the most (a camera, a backup) is rarely the one that downloads the most. Period buttons cover right now, today, 7 days and 30 days, and any row can be slowed down.
- Try: the two tabs (the indicator springs across and the page changes), Downloading and Uploading on the second tab (the podium and the headline change), the period buttons (Right now switches to Mbps and reorders), Slow down on a row (it queues a limit into pending changes), Tweaks > role viewer, stage failure, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Podium columns grow from the floor in order of rank and the crown bobs over first place; bar fills sweep out behind each row; the tab indicator springs across; the hero number counts up.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the device list; the router already keeps per-device traffic counters when statistics are on.
- Still unbuilt in the real app: The ranking, both tabs, the periods and the one-tap limit are design only.

### Wi-Fi diagnostics (page id `wdiag`)

**Wi-Fi diagnostics** (`WifiDiag.dc.html`, 1440 wide, fills, interactive)

- Shows: Why the Wi-Fi is slow, worked out for you: a health score with a radar of nearby networks, findings in order of how much they hurt with a one-tap fix on each, one device under the microscope (signal over the last hour with its roams), who is using the air on each band, retries by device, roaming and drop events as a timeline, a walk test that paints signal as you move, and how the test itself is run.
- Try: the device picker (one device at a time), the band buttons, the fix buttons (success), the walk-test switch, the probe slider, Tweaks > stage failure (radio off), role viewer, motion calm (the radar stills), lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: A radar sweeps with blips while the radios are listened to; the health number counts up; the signal line draws in with a gradient sweep; airtime bars grow; timeline rows cascade; the first fix has a rotating conic border.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the wireless domain: clients, signal and channel per band are already read.
- Still unbuilt in the real app: The health score, findings with fixes, per-device history, airtime split, the roaming timeline and the walk test are design only.

### Ports and hardware (page id `hardware`)

**Ports and hardware** (`PortsHardware.dc.html`, 1440 wide, fills, interactive)

- Shows: The box itself: the back panel drawn as real sockets you can click, with link lights and speeds; the selected port with its speed, what is plugged in and its settings; temperatures as gauges, the processor and memory over the last hour, the lights with a night schedule, what the buttons on the case do, the USB ports and power draw.
- Try: click each socket on the back panel (the port card follows; LAN 3 shows the slow link, LAN 4 shows empty), the speed buttons, the lights switch and brightness, the WPS button role, Tweaks > firmware stock (the lights tile locks), stage failure, role viewer, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Link lights blink at different rates; the selected socket lifts; temperature gauges draw; the processor line draws in with a gradient sweep; the fan icon spins at its real rate; tiles arrive staggered.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the system domain: model, uptime, load and memory.
- Still unbuilt in the real app: The back panel, per-port speeds and settings, temperatures, lights, button roles and power draw are design only.

### Network services, web access and cloud (page id `services`)

**Network services and web access** (`Services.dc.html`, 1440 wide, fills, interactive)

- Shows: Everything the router itself runs and who can reach it: each service as a card with a switch and its port, the question "who can open the router page" answered with three large choices, the certificate with its days left as a gauge, sign-in protection, the addresses allowed in from outside, and an outside check that lists what the internet can actually see.
- Try: the service switches (each queues a change), the three web access choices, the port pickers with presets, the lock-out stepper, the allowed address picker, Check from outside (success), Tweaks > stage failure, role viewer, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Service cards arrive staggered; the days-left gauge draws; the outside check has a rotating conic border and a radar sweep; success bursts and failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the settings catalogue already covers SSH, web access and UPnP as plain fields.
- Still unbuilt in the real app: The service cards, the outside check, the certificate gauge and sign-in protection are design only.

**Cloud** (`Cloud.dc.html`, 1440 wide, fills, interactive)

- Shows: Every way the router talks to somebody else's servers, in one place: a live map of the links that are on, each cloud feature as a card with a switch and a plain sentence about what it sends, a tile that lists what leaves the house and what never does, the linked account, and one switch that cuts all of them at once.
- Try: the feature switches, Cut every cloud link (success), the data-sharing switches, Unlink the account (failure), Tweaks > firmware stock (the names change), role viewer, motion calm (packets stop), lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Packets travel along each link that is on; nodes pop in; feature cards arrive staggered; the cut-all action has a rotating conic border; success bursts and failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: nothing yet.
- Still unbuilt in the real app: The whole cloud page is design only: the link map, feature cards, the data list and the cut-all switch.

### Firewall internals (page id `fwint`)

**Firewall internals** (`FirewallInternals.dc.html`, 1440 wide, fills, interactive)

- Shows: What the firewall actually does, under the friendly rules: the path a packet takes through the five chains as boxes you can click, the real rules of the selected chain with how many packets each one has matched, the connection table as a gauge with its busiest devices, a packet tracer that shows which rule would decide a given connection, the dropped-packet log and, on Asuswrt-Merlin, custom rules.
- Try: click each chain on the packet path (the rule list and its description change), the table buttons, the tracer device and port pickers, Trace (success), Tweaks > firmware stock (custom rules lock), role viewer, stage failure, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: Dashes run along the packet path between the chains; chain boxes pop in; bars sweep out behind each rule in proportion to its packets; the connection gauge draws; log lines arrive one by one.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the firewall domain as on or off settings and port forwards.
- Still unbuilt in the real app: Reading chains and counters, the connection table, the tracer and custom rules are design only.

### Guest Pro and captive portal (page id `guest`)

**Guest Pro and captive portal** (`GuestPro.dc.html`, 1440 wide, fills, interactive)

- Shows: Guest networks done properly: the five Guest Pro profiles as cards with switches (party, shop, kids, smart home, VPN), a designer for the page guests see before they get online with a live phone preview that follows every choice, three ways in (one tap, a passcode, printed vouchers), time and speed limits, vouchers with a QR code, and the guests online now with a way to end a visit.
- Try: the portal style buttons (the phone preview changes title and colour), the three ways in (the preview button and field change), the terms switch, the limit sliders, Make vouchers, Publish (success), End visit on a guest, Tweaks > stage failure, role viewer, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: The phone preview rises in and its background shifts between styles; profile cards arrive staggered; the QR assembles; the hero number counts up; Publish has a rotating conic border; success bursts and failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: the guest Wi-Fi on or off setting per band.
- Still unbuilt in the real app: Profiles, the captive portal and its designer, vouchers, limits and the live guest list are design only.

### DSL (page id `dsl`)

**DSL line** (`Dsl.dc.html`, 1440 wide, fills, interactive)

- Shows: The phone-line side of a DSL router (the example is a DSL-AX82U; the RT-AX86U used elsewhere on the canvas has no DSL port, and its empty stage says so): sync speeds and margin as a hero, the tones that carry the data drawn one bar each with download and upload bands and a notch, margin over a day, error counters, the stability slider and line switches, what a resync costs, and line events as a timeline.
- Try: the stability slider, the mode buttons, the line switches, Resync the line (success; the hero warns it costs a minute and asks at brother Level 2), Tweaks > stage empty (no DSL port on this model) and failure, role viewer, motion calm, lang.
- Tweaks: accent, dark, motion, firmware, role, lang, plus `stage` (loading, empty, ready, success, failure; default ready).
- Dramatic motion: A hundred and fifty tone bars rise one after another; the margin line draws in with a gradient sweep; gauges draw; the hero number counts up; Resync has a rotating conic border; success bursts and failure shakes.
- Normal motion: staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.
- Stands for: nothing yet: the app has only been used with Ethernet-WAN models.
- Still unbuilt in the real app: The whole DSL page is design only.

### The router add-on page (page id `addon`)

**The router's own page for the add-on** (`RouterAddon.dc.html`, 390 by 844, fixed root, interactive)

- Shows: The page the add-on adds to the router's own web interface, drawn in the style of the Asuswrt-Merlin administration pages (the dark grey #4D595D panel) and not in the app's style, because that is where it lives. Title "Material Router", On and Off, the port (8790), "Which version opens (remembered by this browser)" with a Material version card and an Advanced version card, the Open link, and the note that switching it on or off restarts only this app.
- Try: On and Off (the Open link leaves when it is off); the port buttons (the link follows); the two version cards (the link text and address follow); Apply; Tweaks > lang, accent (only the Open link takes the accent), role viewer. Dark has no effect here on purpose: the router page has one look.
- Tweaks: accent, dark, motion, firmware, role, lang.
- Dramatic motion: None; this page only carries normal motion.
- Normal motion: The page fades in; the chosen version card lifts; the Open link and the saved line pop in.
- Stands for: the add-on page on the router (addon/webui), reached from the router's own menu.
- Still unbuilt in the real app: Nothing on this board is missing from the add-on.

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
6. The owner tools and safety sequence from the second pass: the SSH action catalogue, the owner terminal, the four keys, the brother level with its Level 3 warning, the launch sequence and the live reboot timeline, Live mode and the History manager.
7. Household, the leaderboard, and the diagnostics and services pages (Wi-Fi diagnostics, ports and hardware, services, cloud, firewall internals, Guest Pro, DSL).
8. App-side areas: notifications centre, tabs, appearance and motion editor, language tone, app modes, locks and roles, regex builder, updates, toolbox, server manager, deploy assistant.

## How the canvas was checked

- `node gen.mjs` writes every file, then runs a small stand-in for the canvas runtime over every board: every value hole must resolve in the default Tweaks, in Cantonese + dark + stock firmware + viewer + calm, and in each of the other four stages; tags must balance; every handler is called once from a fresh state and the board re-rendered; and every file is scanned for the repository rules (no private-range IPv4, no forbidden word, no account prefix before an address, no long dash, no machine path, no bare input).
- Each board was pre-rendered to static HTML with `theme.css`, opened in headless Microsoft Edge at its board size, and captured in the default Tweaks and in calm + dark + Cantonese + stock + viewer. Hero boards were captured twice 600 ms apart to confirm that things move. The captures were looked at and the boards corrected.

## Known gaps in the canvas itself

- The boards were verified with a stand-in for the runtime, not inside the live canvas. `support.js` is not in the repository, so behaviour that depends on the real runtime (keeping DOM nodes between renders so that position transitions play, `onInput` on range sliders) was not observed there.
- Board heights in `canvas.json` were measured from the static pre-render in a desktop browser. Desktop boards use `expand: fill`, so a difference only changes the empty space under a board.
- The leaderboard's second tab, and every other state that is reached by a click, was checked by rendering the board with that state set; the default captures show the first tab.
- The DSL board uses a DSL-AX82U as its example because the RT-AX86U has no DSL port; its empty stage says so.
- The Level 3 warning and the three-word screen cover the whole board, including the rail. In the canvas they cover the board frame, not the canvas.
- The rail is long (eight groups). It collapses the Visual editors group to one entry outside the editors, and the Router group to one entry inside them, so that no board is much shorter than its rail.
- A drag is pick-then-place (two clicks) on every editor.
- Paint-grid cells are 30 px tall and the address-map cells are smaller still, below the 44 px target size. Both have full-size routes beside them: presets and steppers.
- Count-up numbers are drawn with a CSS counter. Each carries an `aria-label` with the value, but the figure is not selectable text.
- The regex builder is far from parity with a dedicated regex tool; the board lists what is missing.
- Captures on the documentation website board are placeholders until real captures of a built release exist.
- Glass panels rely on `backdrop-filter`, colour roles on relative `oklch()` colours, counters on `@property`, and packets on `offset-path`. All four need a current Chromium, which both delivery forms of the app use.
