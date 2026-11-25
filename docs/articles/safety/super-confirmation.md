---
title: Two-key confirmation for reboots
category: safety
order: 5
summary: Rebooting the router needs the exact model name typed and a press-and-hold, so it cannot happen by accident.
status: in-progress
related: safety/safe-changes, safety/roles-and-access, router/maintenance
---

A reboot drops every device on the network for a minute or two, and a reboot at the wrong moment can interrupt a download, a call or a firmware write. For that reason it is not treated as an ordinary change. It needs two separate deliberate actions, which this guide calls the two-key confirmation.

> [!NOTE]
> The server side is implemented: a reboot request is refused unless both keys are present. The on-screen reboot dialog is **In progress**.

## The two keys

| Key | What you do | What it prevents |
| --- | --- | --- |
| Key 1 | Type the router's model name exactly, for example `RT-AX88U`, into the box. | Rebooting the wrong router when the app is connected to more than one, or pressing a button without reading. |
| Key 2 | Press and hold the reboot button until the ring fills. | A stray click or a double-tap. |

The model name is read from the router, not from a list in the app, so the typed text has to match what the router reports.

## Reboot the router

1. Open **Maintenance** and choose **Reboot**. See the [maintenance guide](../router/maintenance.md).
2. Read the warning, which lists how long the network will be unavailable.
3. Type the model name.
4. Press and hold the button. Letting go early cancels.
5. The app shows that it sent the command and waits for the router to come back. It reports the time it took, or says that the router has not answered yet.

> [!WARNING]
> There is no timed revert for a reboot because a reboot is not a stored value. If the router does not come back, check its power and lights, then try again.

## What the server checks

The check is done on the server, not only in the page. A request that is missing the typed model or the hold flag is answered with a refusal that names the missing key, even if it did not come from the normal screen.

## Who can reboot

Owners and operators. Viewers never see the reboot button as active. See [roles and access](roles-and-access.md).

## Tips

- Schedule a reboot for a quiet time and tell the people who use the network.
- Keep your own sessions short: the app will be unable to talk to the router while it restarts.
- A reboot is recorded in the [change history](change-history.md) with the person and the time.
