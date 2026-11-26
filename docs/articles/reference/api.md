---
title: API overview
category: reference
order: 1
summary: Every HTTP route the app serves, who may call it, and how requests are protected.
status: ready
related: reference/security-model, reference/environment-variables, safety/safe-changes
---

The web pages talk to the server through a small JSON API. It is meant for the app's own pages, not as a public integration surface, so routes can change between versions. This reference lists what exists today.

## Conventions

- Requests and replies are JSON unless noted. A request body larger than 1 MiB is refused with `That request is too large.`; the restore route allows up to 6 MiB.
- Errors return a JSON object with a readable `error` message and sometimes a `code`, with a matching HTTP status.
- Signing in sets an `HttpOnly`, `SameSite=Strict` session cookie that lasts 90 days from the last use. The app sends the cookie again about once a day while it is in use, and sessions survive a restart.
- Every request that changes something (anything except `GET` and `HEAD`) must send the session's token in an `X-CSRF` header. The token comes from `/api/session` or from the sign-in reply. A wrong or missing token returns 403 with code `CSRF`.
- Roles: **O** owner only, **W** owner and operator, **R** every signed-in role, **P** public (no sign-in).

## Public routes

| Method and path | Role | Purpose |
| --- | --- | --- |
| `GET /health` | P | Version and coarse router state, used by Docker's health check |
| `GET /api/session` | P | Whether setup is needed, whether you are signed in, your role, the CSRF token, the router state |
| `POST /api/setup` | P | Create the owner. Allowed once. Needs `username`, `password`, optional `name` |
| `POST /api/login` | P | Sign in with `username` and `password`. Rate limited per address |

Example `GET /health` reply (an example, not from your system):

```json
{ "ok": true, "version": "0.1.0", "router": "connected" }
```

## Session

| Method and path | Role | Purpose |
| --- | --- | --- |
| `POST /api/logout` | R | End the session |

## People

| Method and path | Role | Purpose |
| --- | --- | --- |
| `GET /api/users` | O | The owner and everyone else, without any password data |
| `POST /api/users` | O | Add an operator or viewer |
| `PATCH /api/users/:id` | O | Change `role`, `name` or `password`. Ends that person's sessions on a role or password change |
| `DELETE /api/users/:id` | O | Remove a person and end their sessions |

## Router connection

| Method and path | Role | Purpose |
| --- | --- | --- |
| `GET /api/router` | R | Connection view: address, port, user, method, firmware, pinned host key, demo flag. Never a password |
| `POST /api/router/connect` | O | Connect with `host`, `port`, `username`, `authType` (`key` or `password`), `password`. May answer 409 with a host key to approve |
| `POST /api/router/approve-host-key` | O | Approve the pending fingerprint within 5 minutes |
| `POST /api/router/key` | O | Generate the app's SSH key and return its public half. Replacing a key in use needs `replace: true` |
| `POST /api/router/forget` | O | Remove the saved connection and stored password |

## Reading router data

| Method and path | Role | Purpose |
| --- | --- | --- |
| `GET /api/catalog` | R | Router info, the area list, and every known setting with its friendly label and current value |
| `GET /api/domain/:id` | R | One area's data. Overview, Devices and Advanced always read live. `history` returns the change history |
| `GET /api/logs` | R | The router log, with query options |
| `POST /api/reveal` | W | Return the value of one secret setting, such as a Wi-Fi password, by `id` or `key` |

> [!WARNING]
> `POST /api/reveal` returns a secret in clear text to the owner and operators, who can already change the router. Viewers are refused, because a viewer's request is limited to reading and previewing. Secrets are masked everywhere else (lists and backups).

## Safe changes

| Method and path | Role | Purpose |
| --- | --- | --- |
| `POST /api/changes/preview` | R | Turn a list of changes into a preview with old and new values. Changes nothing |
| `POST /api/changes/apply` | W | Apply a preview by `previewId`. Previews expire. Optional `verifyHost` |
| `GET /api/changes/history` | R | The history |
| `GET /api/changes/history/:id` | R | One record |
| `POST /api/changes/:id/undo` | W | Undo an applied change by applying its saved previous values as a new change |
| `GET /api/settings` | R | Read `guardSeconds`, the timed revert length |
| `POST /api/settings` | W | Set `guardSeconds` from 20 to 600 (the default is 90) |

## Actions

`POST /api/actions/:name` runs one action. Names: `ping`, `traceroute`, `nslookup`, `wake`, `restart-service`, `reboot`, `install-key`.

| Action | Role | Notes |
| --- | --- | --- |
| `ping`, `traceroute`, `nslookup` | W | Network tools, see [Network tools](../tools/network-tools.md) |
| `wake` | W | Wake-on-LAN for a MAC address |
| `restart-service` | W | Only services on the app's allow list |
| `reboot` | W | Two-key confirmation: the exact router model in `confirm` and `hold: true`. Otherwise 403 with code `CONFIRM_MODEL` or `CONFIRM_HOLD` |
| `install-key` | O | Returns a preview that adds the app's public key to the router's allowed keys |

## Backup and restore

| Method and path | Role | Purpose |
| --- | --- | --- |
| `GET /api/backup` | R | Download the router's settings as JSON. Secrets are masked. `?secrets=1` includes them and is owner only |
| `POST /api/restore` | W | Upload a backup. Returns a preview of what differs and a list of skipped settings. Nothing is applied until you apply that preview |

## Static files

Any other `GET` returns a page or asset from the app. Unknown paths without a file extension return the main page, so deep links work. Responses carry a strict Content Security Policy that allows only the app's own scripts and styles, and `X-Frame-Options: DENY`.

## Status codes

| Code | Meaning |
| --- | --- |
| 400 | The request is not valid |
| 401 | Not signed in, or wrong credentials |
| 403 | Role refused, bad CSRF token or missing confirmation |
| 404 | Unknown route, setting, action or history item |
| 409 | Conflict, for example host key approval needed or a setting changed since the preview |
| 410 | A preview expired |
| 413 | Request too large |
| 429 | Too many failed sign-ins |
| 502 | The router did not accept something the app needed |
