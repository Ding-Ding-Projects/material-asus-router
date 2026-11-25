# Server features

Every feature is one folder, `server/features/<id>/index.mjs`, whose default export describes
what it adds. The registry (`registry.mjs`) finds the folders at startup, in sorted order, and
merges them into the catalogue, the screens, the routes, the actions and the pretend router.
**A feature never edits a shared file.** Copy `example-uptime/` to start.

A feature folder also needs `tests/features/<id>.test.mjs` (the control check fails without it) and,
if it has a screen, `public/js/features/<id>/` (see `public/js/features/README.md`).

## The contract lanes must follow

1. **One folder, no shared edits.** Add `server/features/<id>/`, optionally `public/js/features/<id>/`,
   and `tests/features/<id>.test.mjs`. The folder name, the `id` and every entry id prefix match:
   lowercase letters, digits and dashes, entry ids start with `<id>.`.
2. **Import only the kit.** Server code in a feature imports `../kit.mjs`, `node:` modules and files
   inside its own folder, nothing else. This keeps the registry free of import cycles. The kit
   re-exports `L`, `ON_OFF`, `DAY`, `quote`, `nvramKey`, `isIpv4`, `isMac`, `hostTarget`,
   `macAddress`, `parseRows`, `formatRows` and `cleanText`.
3. **Settings are never bare text boxes.** Every setting is a real, typed, rich control, always reading
   the router's actual value and always writing through the change engine (preview, guard, undo).
   Free text is allowed only where the value is genuinely free text (a network name), and then the
   entry says so with `freeText: true` and a `freeTextReason`, and still has `maxLength` and a `hint`.
   The check `tests/real-controls.test.mjs` enforces this for every entry of every feature.
4. **Every router write goes through the change engine.** Entries are changed by `/api/changes/preview`
   and `/api/changes/apply`. An action that needs to write calls `ctx.preview(input)` and returns the
   preview; it never runs `nvram set` itself. Every command sent to the router is built from validated
   pieces (use the kit's `quote`, `nvramKey`, `hostTarget`, `macAddress`).
5. **Labels and help are bilingual.** Every `label` and `help` is `L("English", "廣東話")`.
6. **Test against the pretend router.** Put the feature's starting settings and the answers to its own
   commands in `fakeRouter`, so tests and demo mode never need a real router.
7. **Ordinary professional English in code and docs, and only reserved example addresses:** the demo
   network is `198.51.100.0/24` (router `198.51.100.1`); use `203.0.113.x` or `192.0.2.x` for outside
   addresses. Never write a real or private-range address.

## The default export

```js
export default {
  id: "my-feature",                      // must equal the folder name

  catalog(info) { return [ /* entries */ ]; },        // settings, same shape as router/catalog.mjs
  domainMeta: [{ id, icon, label: L(..), group, requires?, firmware?, live? }],
  domains: { [domainId]: async (ctx) => data },       // a screen's data: GET /api/domain/<id>
  routes(api) { api.get("/path", handler); },         // GET/POST/PATCH/PUT/DELETE under /api/x/<id>
  actions: { name: { risk, confirm?, run(ctx) } },    // POST /api/actions/<id>.<name>
  controls: { type: { validate, sample, invalid } },  // a brand new control type
  fakeRouter: { nvram: {..} | (opts) => ({..}), handlers: [(command, router) => result | undefined] },
};
```

Everything is optional except `id`. A feature that fails to load is reported in `featureErrors`
(and the control check fails); it never stops the server or the other features.

### `catalog(info)` entries

An entry has the fields of `server/router/catalog.mjs`: `id`, `key` (the nvram setting), `control`,
`label`, `help`, `risk` (`low`, `network` or `destructive`, default `low`), `restart` (a service to
restart, default none), `group`/`groupLabel`, `domain` (default: the feature id), and the control's
own fields. Other fields: `optional`, `requires` (a capability from `rc_support`), `firmware: "merlin"`,
`readOnly: true` (shown, never written), `secret: true` (masked everywhere), `verifyKey: true` (use when you are
not sure the setting name exists on every firmware: the control is shown disabled with the reason "This router
does not have the setting <key>" unless the router's own settings list has the key). `info` is what detection
found: `model`, `merlin`, `bands`, `capabilities`, `lan`. An entry whose `id` or `key` is already used
is reported and skipped; the stock entries always win.

### Control types and what each entry must say

| `control` | Value in nvram | Entry fields |
| --- | --- | --- |
| `switch` | `values.on` or `values.off` | `values: { on: "1", off: "0" }` |
| `select`, `segmented` | one of the options | `options: [[value, L(..), about?]]` |
| `number`, `slider`, `stepper` | a whole number | `min`, `max`, `step?`, `unit?` |
| `ipv4` | `198.51.100.20` | `optional?` |
| `cidr` | `198.51.100.0/24` | `minPrefix?`, `maxPrefix?`, `network?` (must be a network start) |
| `range` | `198.51.100.50-198.51.100.99` | `within?: "198.51.100.0/24"` |
| `port` | `8080`, or `8000:8010` | `min?`, `max?`, `allowRange?`, `presets?: [[port, L(..)]]` |
| `mac`, `device` | `AA:BB:CC:DD:EE:FF` (stored upper case) | `optional?` |
| `hostname` | `pool.ntp.org` | `optional?` |
| `schedule` | `12345@08:00-17:00,06@10:00-12:00` (days 0 = Sunday to 6) | `step?` minutes per grid cell |
| `chips` | `a,b,c` | `delimiter?`, `options?`, `pattern?`, `maxItems?` |
| `color` | `#3366cc` | none |
| `file` | one line of text or base64 | `maxLength?`, `encoding?: "base64"`, `accept?` |
| `password` | text, always masked | `secret: true`, `minLength`, `maxLength` |
| `text` | text | only with `freeText: true`, `freeTextReason`, `maxLength`, `hint?` |

### Adding a new control type

Add `controls: { thermostat: { validate(entry, text, fail), sample(entry, current), invalid(entry) } }`
to the feature. `validate` returns the string to store or calls `fail("what to fix")`. `sample`
returns a valid value that differs from `current`, and `invalid` a value that must be refused; the
check uses them to prove the control. Then register the matching browser control with
`ctx.controls.registerControl` (see `public/js/features/README.md`). A type name is unique across
features.

### `domains`

`async (ctx) => data`. `ctx` has `exec(command)`, `nvram` (a `Map` of every setting), `info`, `catalog`,
`session`, `query` (the query string as an object) and `entries(domainId?)`, which returns this
feature's catalogue entries with their current values, ready for the browser. The result is sent as
`{ id, ...data }`. Every `domains` key needs a matching `domainMeta` item; set `live: true` to always
read fresh values, `requires` or `firmware` to show the screen as unsupported on routers without them.

### `routes(api)`

`api.get(path, handler, flags?)`, `api.post`, `api.patch`, `api.put`, `api.delete`. The path is
relative to `/api/x/<id>` and may contain `:name` parameters. The handler gets
`{ body, query, params, who, live, preview, bad }`: `live()` returns the router context, `preview(input)`
runs the change engine's preview, `bad(message, status)` makes an error. Routes always require a
signed-in session, a CSRF token for writes, and the role rules (viewers can only read); a feature
cannot make a route public. `flags.limit` raises the request size limit in bytes.

### `actions`

`{ risk, confirm?, run(ctx) }`, called through `POST /api/actions/<id>.<name>`. `ctx` has `body`,
`session`, `info`, `who`, `exec(command)`, `nvram()` and `preview(input)`. `risk: "destructive"`
requires the router model typed exactly and the hold button (`body.confirm`, `body.hold`) unless
`confirm: ["model"]` or `["hold"]` narrows it. Anything above `low` clears the cached settings after it runs.

### `fakeRouter`

`nvram` adds starting settings to every pretend router (or a function of `{ firmware, model }`).
`handlers` are `(command, router) => { stdout, stderr, code } | undefined`; they run before the
pretend router's own answers, first on the whole command and then on each `;`-separated part, so they
must return `undefined` for anything they do not recognise and have no side effects until they do.
