# Material Asus Router: design handoff

This folder holds the design canvas for Material Asus Router, a self-hosted web app and Windows desktop app that manages an Asus router (stock ASUS or Asuswrt-Merlin) over SSH.

- `design/canvas/project` is the canvas project: 79 boards (77 screens plus the two shared shell components), `theme.css` and `canvas.json`.
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

`stage` is on all 77 screen boards (not on the two shell components, which have no stages). The shell components add their own content props: `page` and `pending` on the rail; `title`, `tabs` and `active` on the top bar.

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

Every board is interactive: all 2 200 or so handlers are wired to board state, and the generator operates each one and re-renders the board as a check. The boards with their own logic beyond the shared controls:

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

A drag is two clicks on the canvas (pick, then place) because the canvas runtime exposes click handlers. The app should offer pointer drag and keep the two-click route as the keyboard and switch-access path.
