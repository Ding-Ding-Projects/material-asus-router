# Documentation contract

This folder is the source of the documentation site at <https://ding-ding-projects.github.io/material-asus-router/>. Every Markdown file here becomes a page. Build the site with:

```
node scripts/build-site.mjs site
node scripts/build-pdf.mjs site      # optional: phone PDF, needs Chrome or Edge
```

The build fails when front matter is wrong, a link does not resolve, a related slug does not exist, or an image is not allowed. It prints warnings for everything it can work around.

## Folders

| Folder | Becomes |
| --- | --- |
| `docs/articles/<category>/<name>.md` | A guide at `articles/<category>/<name>.html` with slug `<category>/<name>` |
| `docs/articles/<category>/<name>.zh-HK.md` | The Cantonese twin of that guide (optional) |
| `docs/wiki/<name>.md` | A wiki page with slug `wiki:<name>` |
| `docs/wiki/<name>.zh-HK.md` | The Cantonese twin of that wiki page (optional) |

Files named `README.md` and anything outside these folders are not published as pages.

## Front matter

Every file starts with a front matter block. Keys are one per line, `key: value`, no nested values.

```
---
title: Change Wi-Fi settings
category: router
order: 3
summary: Rename a network, change its password and channel, and manage the guest network.
status: in-progress
related: safety/connection-guard, safety/undo-changes
---
```

| Key | Needed for | Rule |
| --- | --- | --- |
| `title` | all | Plain text, no Markdown |
| `category` | articles | One of the category ids below; must match the folder name |
| `order` | all | A number. Guides are listed and linked previous/next by ascending order inside a category |
| `summary` | all | One sentence, plain text. Shown on cards, in search and under the title |
| `status` | articles | `ready` or `in-progress`. Use `ready` only when the feature is built and checked |
| `related` | optional | Comma-separated slugs: `router/wifi`, `wiki:home` |

The Cantonese twin repeats `title` and `summary` in Cantonese. Its other keys are ignored; the English file owns them.

## Categories

| Id | Purpose |
| --- | --- |
| `start` | What the app is and how to try it |
| `setup` | Install, connect the router, firmware detection, first account |
| `router` | One guide per router area (Overview, Devices, Wi-Fi, Internet, Local network, Port forwarding, Firewall, Parental controls, Traffic priority, VPN, AiMesh, USB and storage, Logs, Scheduled jobs, Backup and restore, Firmware, System, Maintenance, Merlin extras, Advanced) |
| `safety` | Previews, the connection-loss guard, undo, change history, reboot confirmation |
| `tools` | Network tools: ping, traceroute, name lookup |
| `app` | The app's own features: accounts and roles, language, appearance, navigation, records, safety controls, built-in tools |
| `delivery` | Docker, the Windows desktop app, releases and verification |
| `reference` | Settings, commands, security notes, troubleshooting |

## Links between pages

Use ordinary relative Markdown links to the `.md` file. They work on GitHub and on the site.

```
[Connection-loss guard](../safety/connection-guard.md)
[Welcome](../../articles/start/welcome.md#how-a-change-works)
```

From a wiki page, link to a guide with `../articles/<category>/<name>.md`. A link to any other file in the repository becomes a link to its page on GitHub. As a shortcut, `[[router/wifi]]` or `[[router/wifi|the Wi-Fi guide]]` links by slug; `[[wiki:home]]` links to a wiki page. Link to a section with the heading's anchor, which is the lowercase heading with spaces turned into hyphens.

## Images

Only real captures are allowed, and each must be listed in `evidence/manifest.json`:

```json
{
  "captures": [
    {
      "file": "evidence/overview-light.png",
      "alt": "The Overview screen in the light theme",
      "caption": "Overview, light theme",
      "state": "Demo router, 1280 by 800",
      "commit": "abc1234"
    }
  ]
}
```

Reference it from a page with its path relative to the page, for example `![The Overview screen](../../../evidence/overview-light.png)`. Alt text is required. An image that is not in the manifest is replaced by a clear placeholder, and the build prints a warning. Remote images are not allowed.

## Writing rules

- Plain, professional English. Cantonese twins use natural Hong Kong Cantonese in traditional characters.
- Use `198.51.100.1` and `198.51.100.0/24` for example addresses. Never use real names, addresses or secrets.
- Label every sample output as an example. Never present it as output from the reader's router.
- Be honest about status: describe unbuilt features as planned, set `status: in-progress`, and say what is missing.
- Callouts: start a block quote with `[!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!IMPORTANT]` or `[!EXAMPLE]`.
- Code fences carry a language label and get a copy button.

## Interactive demonstrations

The site ships twelve small simulations, each an ES module in `site-src/sims/` that draws with SVG. Every one is labelled "Demonstration, not your router", uses made-up data from the `198.51.100.0/24` and `203.0.113.x` documentation ranges, can be driven with the keyboard, and has Play or Pause, Step and Reset buttons. When the site's motion setting is "reduced" or "none", or the visitor's system asks for reduced motion, nothing animates on its own and the Play button is disabled; Step and the controls still work, so every state can be reached as a still frame.

To put one in an article, write a directive on a line of its own, with a blank line before and after:

```
::sim[change-guard]
```

The build replaces the line with a placeholder card (title, summary and a note that JavaScript is needed). In the browser, `assets/sims/loader.js` finds each placeholder and mounts the live demonstration when it scrolls near the viewport, so a long article with several demonstrations stays light. An unknown name stops the build and lists the valid names. The directive is ignored inside code fences, so the example above is safe to copy. The phone PDF edition shows only the static card.

| Name | What it shows |
| --- | --- |
| `change-guard` | Preview, arm, apply, then keep or revert, with adjustable guard time and failure injection |
| `network-map` | Router, AiMesh nodes and devices you can drag, with band and signal |
| `wifi-spectrum` | Neighbouring networks as bell curves, your channel and width, interference score |
| `dhcp-pool` | A grid of addresses: leased, reserved, free, with lease expiry |
| `port-forward` | Packets from the internet meeting forwarding rules |
| `firewall` | Packets tested against ordered rules, with a connection table |
| `qos-queues` | Game, call and download flows with and without priority |
| `vpn-director` | Devices routed directly or through a tunnel, with a kill switch |
| `parental-schedule` | A week grid you paint, with a live clock |
| `subnet-calculator` | 32 address bits with a movable prefix boundary |
| `dns-race` | Four resolvers answering one lookup |
| `one-click-modes` | The exact settings a mode would change, with apply and undo |

The gallery page `sims/index.html` lists every demonstration. To add one, create `site-src/sims/sim-<name>.js` that default-exports `{ id, title, summary, hint, label, view, setup(ui) }` (copy a small existing module), add an entry to `site-src/sims/registry.json` with a short kind label and the related guide's slug, and run `node scripts/build-site.mjs site`. Text shown to readers must be English and Cantonese pairs, built with the `ui.txt` and `ui.say` helpers so the language setting applies.
