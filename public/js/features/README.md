# Browser features

A feature's browser code is one folder, `public/js/features/<id>/`, with an `index.js` whose default
export describes what it adds. At sign-in the app asks `GET /api/features/manifest` for every real
`public/js/features/*/index.js` (sorted), imports each one, and merges it into the navigation rail,
the router, the Feature settings screen, the command palette (Ctrl+K), the top bar and the page.
**A feature never edits a shared file.** Copy `example-uptime/` to start. The server half lives in
`server/features/<id>/` (see `server/features/README.md`) and the test in `tests/features/<id>.test.mjs`.

One broken module is reported in the console and skipped; the app and the other features keep working.

## The contract lanes must follow

1. **One folder.** `public/js/features/<id>/index.js` plus any files it imports from inside its own
   folder. A `style.css` in the folder is loaded automatically (the strict CSP allows stylesheets from
   this site only: no inline styles, no inline scripts, no remote assets, no `innerHTML`).
2. **Import nothing shared.** Everything arrives in `ctx`. A feature file that imports nothing loads
   fast and can be checked from Node tests. Importing its own files is fine.
3. **Settings are never bare text boxes.** Every setting is drawn by a real, typed, rich control that
   shows the router's actual value and writes through the pending-changes dock, so every change gets
   a preview, the safety net and undo. Use `ctx.controls.settingGroups` and `groupCard` with the
   entries the server sends; they pick the right control from each entry's `control`. Plain free text
   only where the value is truly free text (a network name), with validation, a counter and a hint.
4. **Bilingual.** Every label is `{ en, yue }`; use `ctx.t("English", "廣東話")` for text built in code.
5. **Safe DOM only.** Build elements with `ctx.h`; never write HTML strings.
6. **Reserved example addresses only** (`198.51.100.0/24`, `203.0.113.x`, `192.0.2.x`).

## The default export

```js
export default {
  id: "my-feature",                    // must equal the folder name
  screens:  [{ id, group, icon, label: { en, yue }, render(ctx) }],   // a rail entry and a page
  settings: [{ id, label, icon?, render(ctx) }],                      // a card on Feature settings
  commands: [{ id, label, icon?, keywords?, run(ctx) }],              // a Ctrl+K palette entry
  toolbar:  [{ id, icon, label, onClick(ctx) }],                      // a button in the top bar
  overlays: [{ id, mount(ctx) }],                                     // always-on UI; return a cleanup
  controls: { type: (entry, current, commit, locked, ctx) => ({ el, sync }) }, // a new control type
};
```

Everything is optional except `id`. Item ids are lowercase letters, digits, dots and dashes; a screen
id may not equal a stock screen id or another feature's.

- `screens[].group` is `{ en, yue }`. Use `Monitor`, `Network` or `Router` to join a stock section; any
  other name starts a new section. `render(ctx)` draws into `ctx.root` and may return a cleanup function
  (the stock screens do the same). It may be async.
- A server feature that declares `domainMeta` without a browser screen gets a generic screen that
  shows its catalogue entries as rich controls.
- `settings[].render(ctx)` draws into `ctx.root`, or returns a node or a list of nodes.
- `overlays[].mount(ctx)` runs once when the shell is built.

## `ctx`

| Name | What it is |
| --- | --- |
| `ctx.api` | `get(url)`, `post(url, body)`, `patch(url, body)`, `del(url)`. Sends the CSRF token, throws an `Error` with `status` and `code`. Feature routes are under `/api/x/<id>/...`; one-off actions are `POST /api/actions/<id>.<name>`; a screen's data is `GET /api/domain/<id>`. |
| `ctx.t(en, yue)`, `ctx.tt({ en, yue })` | Text in the language the person chose (English, Cantonese or both). |
| `ctx.getLang()` | `"en"`, `"yue"` or `"both"`. |
| `ctx.h(tag, props, ...kids)` | Builds an element. Props: `class`, `onClick` (any `on...` event), `value`, `checked`, `disabled`, `hidden`, other attributes as strings. Kids may be nodes, strings or arrays. |
| `ctx.icon(name, size?)` | A Material Symbols icon (`"sm"` or `"lg"`). |
| `ctx.clear(el)` | Empties an element. |
| `ctx.page(title, lede, ...children)` | A page with the stock heading and lede. `title` and `lede` are `{ en, yue }`. |
| `ctx.state` | The shared app state: `me` (name and role), `canWrite`, `router`, `catalog` (`info`, `domains`, `entries`), `route`, `notices`. Read it; change it only through the other helpers. |
| `ctx.dock` | The pending-changes dock. `setEntry(entry, value)` queues a catalogue edit, `setRaw(key, value, original, label)` a raw one, `addOp(op, summary)` a list edit, `has(id)`, `value(id)`, `count()`, `clear()`. Nothing reaches the router until the person reviews and applies the changes. |
| `ctx.notifications` | `notice(kind, text)` adds to the bell list (`"good"`, `"warn"`, `"bad"`); `toast(text, kind?)` shows a short message. Also available as `ctx.toast` and `ctx.notice`. |
| `ctx.openDialog(build, { label })` | A modal sheet. `build(close, render)` returns the children; the result has `closed`, a promise for what `close(value)` was given. |
| `ctx.confirmDialog({ title, body, confirm, danger })` | A promise for `true` or `false`. |
| `ctx.bus` | `on(name, fn)` returns an off function; `emit(name, detail)`. Events: `dock`, `notices`, `lang`, `changed` (a change was applied). |
| `ctx.navigate(id)` | Goes to a screen. |
| `ctx.controls` | The controls library below (`settingRow`, `groupCard`, `settingGroups`). |
| `ctx.root`, `ctx.el` | Only in `render`: the element to draw into. |

## The rich controls

`ctx.controls.settingRow(entry)` draws one setting; `groupCard(label, entries, query?)` one card of
rows; `settingGroups(entries)` turns a flat list into `{ id, label, entries }` groups. Each row shows
the label, help, a "Safety net" tag for network-risk entries, an undo-edit button and the control for
the entry's `control` type. The controls that exist today:

| `control` | How it looks |
| --- | --- |
| `switch` | A toggle. |
| `select` | Segmented buttons for four options or fewer, a menu for more; an option's optional third item is a description shown beside it. |
| `segmented` | Always segmented buttons. |
| `slider` | A slider with its unit and current value. |
| `number` | A number box with its unit. |
| `stepper` | A number with minus and plus buttons. |
| `ipv4` | Four address boxes that jump to the next on a dot. |
| `cidr` | Address boxes, a prefix menu, and a bar plus first and last address showing the network size. |
| `range` | First and last address boxes and a bar showing where the range sits in the network. |
| `port` | A number box and one-tap preset ports. |
| `mac`, `device` | A MAC box that formats as you type, and a menu of the known devices. |
| `schedule` | A week grid you click or drag across to paint time slots; keyboard users press Space on a cell. |
| `chips` | Removable chips with an add box, or a menu when the entry has `options`. |
| `color` | A colour swatch and a hex box. |
| `file` | A drop zone and a file button; the file is read as text, or base64 with `encoding: "base64"`. |
| `password` | A hidden box with show/hide (the value is fetched from the router only on request) and a strength bar. |
| `text` (free text only) | A text box with a character counter and an optional `hint`. |

### Adding a control from your own folder

Declare it in `index.js` under `controls`. It is registered before any screen is drawn, so any
setting whose `control` names it is drawn with it, on every screen:

```js
export default {
  id: "thermostat",
  controls: {
    thermostat(entry, current, commit, locked, ctx) {
      const input = ctx.h("input", { type: "range", min: String(entry.min), max: String(entry.max), value: current(), disabled: locked,
        "aria-label": ctx.tt(entry.label), onInput: (e) => commit(e.target.value) });
      return { el: input, sync: () => (input.value = current()) };
    },
  },
};
```

A control factory receives `(entry, current, commit, locked, ctx)`: `current()` is the value as a string,
`commit(string)` records an edit in the dock, `locked` is true when the person may not edit, and the
returned `sync()` redraws after an edit is undone. Add the matching server check with
`controls: { thermostat: { validate, sample, invalid } }` in the feature's server file (see
`server/features/README.md`); the control check needs it. Type names are unique across features.
