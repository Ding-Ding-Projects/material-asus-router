---
title: Data and security model
category: reference
order: 2
summary: What the app stores, how credentials are protected, what each role can do, and what the app does not protect against.
status: ready
related: setup/connect-router, setup/backing-up-data, reference/api, setup/people-and-roles
---

This page says what the app keeps, where, and how it is protected, and is honest about the limits. The app is built to run **on your own network**.

## What is stored

Everything is in the `/data` volume.

| Item | Where | How it is protected |
| --- | --- | --- |
| App passwords | `state.json` | Scrypt hash with a random 16-byte salt. The password itself is never stored |
| Router password (password method) | `vault.json` | Encrypted with AES-256-GCM |
| The app's SSH private key (key method) | `vault.json` | Encrypted with AES-256-GCM |
| Vault encryption key | `vault.key` | A random 32-byte key in its own file, mode 0600 |
| Router address, port, user name, method | `state.json` | Plain text. Not secret |
| Pinned host key fingerprint | `state.json` | Plain text. Not secret |
| Settings (for example the timed revert length) | `state.json` | Plain text |
| Change history | `state.json` | Plain text, with secret values kept masked |
| Sign-ins | `sessions.json` | A SHA-256 of each session cookie, the account it belongs to and when it ends. The cookie value and the per-session token are never stored |

Because the vault key sits beside the vault, the vault protects against someone reading `vault.json` alone (for example a stray copy of the state), but **not** against someone who holds the whole volume. Protect volume backups accordingly, see [Back up the data volume](../setup/backing-up-data.md).

Nothing is sent anywhere else. The app makes no outside network connections of its own, apart from SSH to the router you configure. Its pages load no scripts, fonts or images from other sites, and the Content Security Policy forbids it.

## Signing in

- Passwords are 12 to 256 characters.
- Failed sign-ins are counted per address. After repeated failures the app refuses further tries for 15 minutes.
- A sign-in attempt for an unknown user takes about the same work as one for a real user, so the reply does not reveal which user names exist.
- You stay signed in. A session lasts 90 days from the last time that browser used the app, so regular use never signs you out, and it survives a restart or an update of the app. A browser that has not opened the app for 90 days signs in again.
- A session ends on logout, and ends for a person whose role or password you change or whom you remove. After a restart a saved session is matched to the account as it is now, so it never keeps an old role.
- Sign out on a shared computer: anyone who can use a signed-in browser can use the app.
- The session cookie is `HttpOnly` and `SameSite=Strict`, and is marked `Secure` when the request came over HTTPS.
- Every change request must include a per-session token in the `X-CSRF` header, so another website cannot make your browser change the router.

## Roles

| Role | Read | Preview | Apply, undo, tools | Router connection and people |
| --- | --- | --- | --- | --- |
| Owner | Yes | Yes | Yes | Yes |
| Operator | Yes | Yes | Yes | No |
| Viewer | Yes | Yes | No | No |

The server checks the role on every request. Hiding a button is only a convenience.

## The router connection

- **Host key pinning.** You approve the router's host key fingerprint once. After that the app refuses a different key. A changed key stops the connection and asks the owner to decide.
- **No password in transit to the page.** The router password is typed once, goes to the server, and is never sent back to the browser. The router view never includes it.
- **A key is preferred.** With the app-generated key no router password is stored at all.
- **Secret settings are masked.** Values for settings recognized as secret, such as Wi-Fi passwords, show as masked in lists and in backups. The owner may include them in a backup on purpose, and any role that can change settings may reveal a single value.

## Safe changes

Changes are validated before they are previewed: setting names must be valid, some protected settings cannot be edited, values cannot contain line breaks (except on a few multi-line settings) and are limited to 4096 characters. A single change can touch a limited number of settings. See [Safe changes](../safety/safe-changes.md) and [Connection-loss guard](../safety/connection-guard.md).

## Container hardening

The container runs as a non-root user with a read-only root file system, all Linux capabilities dropped and `no-new-privileges`. See [Docker image and Compose](../delivery/docker-image.md).

## What the app does not protect against

> [!WARNING]
> - **No HTTPS by itself.** The app serves plain HTTP. On a trusted home network that is common, but anyone on that network could read traffic. For anything wider, put it behind your own HTTPS reverse proxy.
> - **Do not expose the port to the Internet.** The app has no multi-factor sign-in and is not hardened for public use.
> - **The router's own password is separate.** Anyone with the router's administrator password can still change the router directly.
> - **First come, first owner.** Create the owner account before sharing the address. See [First owner account](../setup/first-owner-account.md).
> - **A stolen volume is a stolen vault.** Keep backups private.

## Reporting a security problem

Follow the repository's `SECURITY.md`. Do not post exploit details publicly.
