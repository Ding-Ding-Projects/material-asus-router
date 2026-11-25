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
