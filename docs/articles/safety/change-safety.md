---
title: Change safety, live mode and the household
category: safety
order: 9
summary: Live changes, a household impact level on every change, four-key confirmation, a version history, undo and redo, quiet apply and a launch sequence for reboot.
status: in-progress
related: safety/safe-changes, safety/change-history, safety/undo-changes, safety/connection-guard, safety/super-confirmation
---

This page describes what the server does to keep a change from surprising the people at home. The screens that use it are described in [The change-safety screens](change-safety-interface.md) and are **In progress**; the server side described here is built and tested against the pretend router.

## Live mode and review mode

**Live mode** is on by default. A control that is committed (a switch flipped, a field left) is previewed and applied in one step by `POST /api/changes/live`, whatever its level; when the change needs the four keys or the household's say, the answer asks for them. It still goes through the router-side safety timer for anything that can cut the connection. Turn it off in the settings and the app goes back to the preview dock: `POST /api/changes/preview`, then `POST /api/changes/apply`.

## Impact levels

Every setting and every action has a level from 0 to 3, computed from the service it restarts and its risk, then adjusted by a hand-checked table.

| Level | Meaning | Examples |
| --- | --- | --- |
| 0 | Nobody notices | A dynamic DNS name, the time zone |
| 1 | A small blip | The guest network, the lights, a DNS or firewall reload |
| 2 | Everyone's Wi-Fi drops for a few seconds | Wi-Fi channel, password, name or mode |
| 3 | The internet or the router is down, or devices reconnect by hand | The router address, the WAN type, a reboot |

`GET /api/safety/impact` returns the whole table. Every entry in `GET /api/catalog` carries `impact`, and every preview carries `impact`, `shortName` and, from level 1, `allowance`.

## Four-key confirmation

A change or action needs four keys when its level is above the level the household chose (**Most brother madness allowed**, default 1) or above what the household allows right now. At or below both, no keys are asked, so with the default a Level 1 change applies without them and Level 2 and 3 still take them. Choose 0 to have every change above Level 0 take the keys. A reboot always takes them. The rule is the same in live and review mode, and the server checks it; a script that skips the screen is refused. Every preview says whether keys are needed in `confirmation.required`.

1. Acknowledge every person who will be affected.
2. Type the setting's short name exactly.
3. Hold the button for at least 1500 ms.
4. Press the Ctrl+Shift+Enter chord.

When keys are missing the answer is **428** with code `CONFIRM_REQUIRED` and `detail.confirmation` holding a server-issued nonce, the people to acknowledge and the name to type. Send the proof back with the same request: `confirmation: { nonce, ackPeople: [ids], typed, holdMs, chord: true }`. A wrong or missing step is refused with `CONFIRM_ACK`, `CONFIRM_TYPED`, `CONFIRM_HOLD`, `CONFIRM_CHORD` or `CONFIRM_NONCE`. A nonce is for one person and one change, and works once.

## Reboot launch

A reboot cannot be sent with the ordinary action. After the four keys it needs the launch sequence: open the cover, arm (the server issues a launch code), type the code, hold two keys together, start a ten-second countdown that can be aborted, and launch. Each step is checked in order by the server, three wrong codes abort the launch, and the launch refuses to fire early. The reboot then shows a live timeline until the router goes away, answers again and its settings are read back.

## The household and what it allows

The default person is **Your brother** (你兄弟); more people can be added. Each person has devices picked from the device list, a weekly schedule of **at work**, **sleeping** and **at home** blocks, and an allowance from 0 to 3 for each. **Most brother madness allowed** (0 to 3, default 1) is the household's baseline.

Presence has only two sources: whether one of the person's devices is on a home Wi-Fi network right now (the router's Wi-Fi client list), and optionally the current state of Home Assistant entities the owner picked. There is no ping, no address-table or lease tracking, no location and no history of presence.

A change above what the household allows right now is refused with `ALLOWANCE`, and the check runs again when the change is applied. The owner can override with `override: true` plus the four keys; the override is recorded in the history without recording who was home.

## History, undo and redo

Every applied change, undo and restore is one version in a local repository under the data folder. Each version holds readable files per area with friendly labels and raw keys; secret values are replaced by a masked marker. Nothing is ever pushed anywhere. Each person has an undo stack and a redo stack, and each undo is recorded as a version of its own.

## Quiet apply

A change can wait for a time, or for the moment nobody's devices are on the home Wi-Fi. The app runs it by itself, still under the allowance, and records it as a quiet apply.

## API

| Path | Payload and answer |
| --- | --- |
| `GET/POST /api/safety/settings` | `{ liveMode }` |
| `GET /api/safety/impact` | `{ levels, entries, actions, services }` |
| `POST /api/safety/confirm/begin` | `{ previewId }`, `{ action, body }` or `{ schedule }`; answers `{ required, nonce, steps }` |
| `POST /api/changes/live` | `{ changes, confirmation?, override? }` or `{ previewId, confirmation?, override? }` |
| `POST /api/changes/apply` | `{ previewId, confirmation?, override? }` |
| `POST /api/safety/undo`, `/redo` | `{ apply?, previewId?, confirmation? }` |
| `GET /api/safety/undo-state` | `{ undo, redo }` |
| `GET /api/safety/history` | Filters `area`, `person`, `mode`, `source`, `impact`, `since`, `until`, `text`, `regex`, `key`, `limit`, `offset` |
| `GET /api/safety/history/:oid` | One version with its changes |
| `GET /api/safety/history/diff?a=&b=` | Any two versions |
| `GET /api/safety/history/setting?key=` | The history of one setting |
| `POST /api/safety/history/restore` | `{ oid, id or key or all, apply? }` |
| `GET/POST/DELETE /api/safety/history/bookmarks` | Labels on versions |
| `GET /api/safety/history/stats`, `/export` | Statistics, JSON or CSV |
| `GET/POST/DELETE /api/safety/pending` | Waiting changes: `{ changes, when: { at } or { quiet: true }, confirmation? }` |
| `POST /api/safety/launch/begin` and `/:id/<step>` | The reboot launch sequence |
| `GET /api/safety/runs`, `/runs/:id`, `/runs/:id/events` | Live progress as JSON or an event stream |
| `GET/PUT /api/household`, members, devices, presence, allowance | The household |
