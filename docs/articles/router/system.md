---
title: System settings
category: router
order: 22
summary: Time zone, clock, administration and sign-in settings of the router, with the risky ones marked.
status: in-progress
related: router/maintenance, router/firewall, router/logs, setup/connect-router
---

System settings control how the router itself is run: its clock, its own login, and how you can reach its administration. Most of them are safe. A few can lock you out, and those are marked.

> [!NOTE]
> **In progress.** The settings are defined and read from the router; the screen and real-router tests are still being built.

## Settings

| Setting | What it does | Risk | Safe recommendation |
| --- | --- | --- | --- |
| Time zone | Sets the router's local time | Low | Set it correctly; logs, [schedules](parental-controls.md) and [jobs](scheduled-jobs.md) depend on it |
| Time server | Where the router gets the correct time | Low | Leave the default unless your network blocks it |
| Router name | The name shown on the network | Low | Short and unique |
| Administrator name | The login name of the router's own web page | Medium | Change from the factory default; use something not obvious |
| Administrator password | The password of the router's web page | Medium | Long and unique. Stored by the router only; the app never shows it |
| Web page access | Whether the router's page is on the local network only, or also from the internet | **High** | Local only. Opening it to the internet invites attacks |
| Web page port | The port of the router's page | Medium | Keep the default unless you know why |
| SSH | Lets the app and other tools sign in over a secure shell | **High** | Keep on for this app, restricted to the local network, with a key rather than a password |
| Telnet | An old unencrypted login | **High** | Keep off |

## Set the time zone

1. Open **System** and choose **Time zone**.
2. Pick your zone. The preview shows the current router time, and what it will be after the change.
3. Confirm. Scheduled things move with it. Check that your jobs still run at the expected hours.

## Change the router's own password

1. Choose **Administrator password**.
2. Type the new password twice. The strength meter warns about short or common ones.
3. Confirm. The app does not store the new value in history. Write it down in your password manager.

If the app uses the router password to sign in, the stored copy must be updated too. The app offers to do that in the same step; if you skip it, the next connection fails until you update it in the router connection settings ([connect your router](../setup/connect-router.md)). A key-based sign-in is not affected.

## SSH and why it matters here

This app manages the router over SSH. Turning SSH off, changing its port, or restricting it to a network the app cannot reach, will end the connection. The guard cannot repair that, because the app can no longer talk to the router at all. When you change SSH settings, the preview tells you in words whether the app will still be able to connect.

> [!WARNING]
> Never open SSH or the web page to the internet. If you need access from outside, use a [VPN](vpn.md).

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Time, names, passwords | Yes | Yes |
| SSH | On models and versions that include it | Yes, with key login and a choice of port |
| Extra services such as a custom log destination | No | Yes |

## Status

| Part | State |
| --- | --- |
| Setting definitions | Built |
| System screen | In progress |
| Strength meter | In progress |

## Go deeper

- [LEDs and the night mode](../merlin/leds.md)
- [Scheduled reboot](../merlin/scheduled-reboot.md)
- [SSH keys](../merlin/ssh-keys.md)
