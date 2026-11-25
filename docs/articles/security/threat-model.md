---
title: Security deep dive: who could attack what
category: security
order: 7
summary: A plain walk through the realistic ways a home router and this app can be attacked, what stops each one, and what still depends on you.
status: ready
related: reference/security-model, security/hardening-checklist, workflows/ssh-action-catalogue, safety/encrypted-vault
---

Security advice is easier to follow when you know what it is for. This page lists the realistic attackers and what each could try, and says which protection answers it. For how the app stores secrets and signs people in, see [Security model](../reference/security-model.md). For the short to-do list, see the [hardening checklist](hardening-checklist.md).

## Who might attack

| Who | Where from | What they want |
| --- | --- | --- |
| A stranger scanning the internet | Outside | An exposed router page, a weak login, an old firmware hole |
| A neighbour or passer-by | Near your Wi-Fi | A password to borrow your connection |
| A guest or a compromised gadget | Inside | A route to your laptops and files |
| Malware on a family computer | Inside | Your router login, or your saved passwords |
| Someone who finds the app's address | Inside, or outside if it was exposed | A way to change your router through the app |

## Ways in, and what answers them

| Attack | Why it works | What stops it |
| --- | --- | --- |
| Guessing the router login | Default or short passwords | A long unique login, and no router page from the internet. See [System](../router/system.md) |
| Using a known hole in old firmware | Updates were never applied | [Firmware updates](../merlin/firmware-update-walkthrough.md) and replacing end-of-life models |
| Joining your Wi-Fi | A short or shared password, WPS PIN | A long password, WPA2 plus WPA3, [WPS off](../wireless/wps.md) |
| Crossing from a gadget to your laptop | Everything is on one network | The [guest network](../router/guest-network.md) for gadgets and visitors |
| An opened port reaching a weak service | Careless [forwarding](port-forward-safely.md), [UPnP](../lan/upnp.md) or [DMZ](../lan/dmz.md) | Narrow rules, review, deletion when done |
| Sniffing your lookups | Plain DNS | [DNS over TLS](../internet/dns-over-tls.md) |
| Guessing the router's SSH password | Password SSH on the internet | [SSH keys](../merlin/ssh-keys.md), SSH off when unused |
| Tampering with the router's stored settings | Someone with the app and a role | Roles, [previews](../safety/safe-changes.md) and the [change history](../safety/change-history.md) |

## What the app adds

- **Fixed actions.** The browser never gets a shell. See [the SSH action catalogue](../workflows/ssh-action-catalogue.md).
- **Validated input.** Hostnames, hardware addresses, setting names and values are checked, and values are quoted so they stay data.
- **Roles.** Viewers cannot change anything. Only the owner manages people and the router connection. See [Roles and access](../safety/roles-and-access.md).
- **Pinned host key.** If the router's identity changes, the app stops. See [Host key pinning](../safety/host-key-pinning.md).
- **An encrypted vault** for the router login or key, and secrets masked in previews and history. See [Encrypted vault](../safety/encrypted-vault.md).
- **Two-step confirmation** for destructive actions. See [Super confirmation](../safety/super-confirmation.md).
- **No cloud.** Nothing leaves your network.

## What still depends on you

1. **Where the app is reachable.** Keep it on the home network. Reach it from outside through a [VPN](../connect/vpn-servers.md), never by forwarding its port.
2. **The owner password.** There is no email reset. Use a long, unique one in a password manager.
3. **Who gets a role.** Give family the least role that does the job.
4. **The computer that runs it.** If malware owns that computer, it can use the app as you.
5. **Honest limits.** A tested pretend router is not a tested real one. Report anything odd rather than assuming.

## If you think you were compromised

1. Change the Wi-Fi and router passwords from a trusted device.
2. Remove SSH keys you do not recognise, turn off remote access and review forwards and UPnP.
3. Update firmware, then restore settings from a backup made *before* the problem, or set up fresh.
4. Review the [change history](../safety/change-history.md) and the [log](../merlin/logging.md) for what changed and when.

## Status

This is guidance, so it is marked Ready. The controls it names carry their own status on their own pages.
