---
title: Router hardening checklist
category: security
order: 5
summary: The short list of settings that makes the biggest difference to router security, in the order to do them.
status: ready
related: reference/security-model, security/port-forward-safely, router/system, router/firmware
---

You do not need to be an expert. These ten steps close the doors that real attacks use. Do them in order and tick each one off. Where the app has a control, the step names it.

| # | Step | Where | Why |
| --- | --- | --- | --- |
| 1 | Change the router's own login from the default | The router's web page | Default logins are in every attacker's list |
| 2 | Use a long, unique Wi-Fi password and WPA2 plus WPA3 | [Wi-Fi](../router/wifi.md) | The Wi-Fi password is the front door |
| 3 | Update the firmware | [Firmware](../router/firmware.md) | Fixes security holes |
| 4 | Turn off access to the router's page from the internet | [System](../router/system.md): "Router web page from the internet" | Nobody outside needs it |
| 5 | Turn off WPS | [WPS](../wireless/wps.md) | The PIN method is guessable |
| 6 | Use SSH keys, not passwords, and turn SSH off if unused | [SSH keys](../merlin/ssh-keys.md) and [System](../router/system.md) | Password SSH can be guessed |
| 7 | Review port forwards and UPnP | [Port forwarding](../router/port-forwarding.md), [UPnP](../lan/upnp.md) | Every open port is a risk |
| 8 | Keep the firewall and the IPv6 firewall on | [Firewall](../router/firewall.md) | The default protects you |
| 9 | Put guests and smart gadgets on the guest network | [Guest network](../router/guest-network.md) | A hacked gadget cannot reach your laptop |
| 10 | Back up the settings, safely | [Backup and restore](../router/backup-restore.md) | Recover from mistakes fast |

## Check your work

After finishing, run a port check from outside your home, using the [port checker](../tools/port-checker.md) once it is built, or a trusted external scanner. You expect closed ports only, except the ones you opened on purpose.

## Do not forget

- **Routers age.** When a model stops receiving firmware updates, plan to replace it.
- **Remote access** for yourself is safer through a [VPN](../router/vpn.md) than through opening the router page.
- **Share the account carefully.** In the app, give family members the viewer or operator role, not owner. See [Accounts and roles](../app/accounts-and-roles.md).

## Status

This is guidance, not a feature, so it is marked Ready. The controls it refers to have their own status on their own pages.
