---
title: First owner account
category: setup
order: 6
summary: Create the first account, which becomes the owner, and understand what the owner controls.
status: ready
related: setup/people-and-roles, app/accounts-and-roles, reference/security-model
---

The first time you open the app it has no accounts. The first person to create one becomes the **owner**. There is no setup code: whoever reaches the page first wins, so do this step right after starting the app, before sharing the address.

## Create it

1. Open the address printed by `host.bat` or the setup script, for example `http://198.51.100.5:8790/`.
2. Fill in the setup form:
   - **Name** (optional): a display name such as Pat. Up to 80 characters.
   - **User name**: 2 to 40 letters, digits, dots, dashes or underscores, starting with a letter or digit.
   - **Password**: 12 to 256 characters. Use a long phrase you do not use anywhere else.
3. Submit. You are signed in as the owner.

The check that no owner exists is made atomically, so two people cannot both become owner. Anyone who tries afterwards sees "This router manager already has an owner. Sign in instead."

> [!WARNING]
> If someone else reaches an unconfigured app before you do, they become the owner. If that might have happened, stop the app, delete its data volume (see [Back up the data volume](backing-up-data.md) first if you need anything) and start again.

## How passwords are kept

Passwords are never stored as typed. Each is hashed with scrypt and a random salt. Sign-in is rate limited: after repeated failures from one address the app answers "Too many failed sign-ins. Wait 15 minutes and try again." Sessions last 8 hours, use a `HttpOnly`, `SameSite=Strict` cookie and a per-session token that the page must send with every change.

## What the owner can do

| Action | Owner | Operator | Viewer |
| --- | --- | --- | --- |
| Read everything | Yes | Yes | Yes |
| Preview a change | Yes | Yes | Yes |
| Apply, undo, run tools | Yes | Yes | No |
| Connect, approve a host key, forget the router | Yes | No | No |
| Manage people | Yes | No | No |
| Include secrets in a backup | Yes | No | No |
| Allow the app's SSH key on the router | Yes | No | No |

See [People and roles](people-and-roles.md) for adding the others.

## Forgot the owner password

There is no email reset, because the app does not send mail. The owner's account lives in the data volume. The safe options are to restore a backup of the volume from before the change, or to start with a fresh volume and reconnect the router. See [Back up the data volume](backing-up-data.md).

## Next

[Connect your router](connect-router.md).
