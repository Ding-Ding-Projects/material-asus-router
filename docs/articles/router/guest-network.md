---
title: Guest network
category: router
order: 4
summary: Give visitors internet access on a separate Wi-Fi that cannot see your own devices.
status: in-progress
related: router/wifi, router/local-network, router/firewall, safety/connection-guard
---

A guest network is a second Wi-Fi name with its own password. Visitors get internet access, but your printer, file shares and cameras stay out of their reach. It is also a good home for smart-home gadgets you trust less.

> [!NOTE]
> **In progress.** The guest controls are defined in the app, but the screen and real-router tests are still being built. The number of guest networks per band depends on the router model.

## Controls

| Control | What it does | Safe recommendation |
| --- | --- | --- |
| Guest network | Turns the guest Wi-Fi on or off | Turn on only while needed, or leave on if you often have visitors |
| Guest network name | The name visitors look for | Something obvious such as `Home Guest`; do not repeat the main password in it |
| Guest password | 8 to 63 characters | Different from the main Wi-Fi. Change it after parties |
| Guests can reach home devices | Allows guests to see the local network | **Keep off.** Visitors then only get internet |
| Access time | How long a guest network stays on before it turns off (where the firmware supports it) | Use a limit for one-off visits |
| Bandwidth limit | Caps what guests can use (where supported) | Useful on slow connections |

## Set up a guest network

1. Open **Wi-Fi** and go to the **Guest** section of the band you want. Many people enable it on 2.4 GHz and 5 GHz.
2. Switch **Guest network** on and type a name and a password.
3. Make sure **Guests can reach home devices** is off.
4. Review the preview, confirm, and wait for the app to confirm the change reached the router.
5. Join the guest network from a phone and check that internet works but your printer does not appear.

Changing the guest network restarts the wireless service for that band. Devices on the band reconnect within a minute. Because you are normally managing from the main network, the connection-loss guard is armed only if the app sees that your own connection depends on the band.

## Share the password safely

- Show a QR code or read the password out; do not paste it into a group chat.
- Change the guest password after the visit if you gave it to many people.
- Remember that anything a guest does shows up on your internet connection.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Guest on, name, password | Yes | Yes |
| Several guest networks per band | Model dependent | Model dependent |
| Extra guest isolation rules | No | Possible through [Firewall](firewall.md) and [Merlin extras](merlin-extras.md) |

## Status

| Part | State |
| --- | --- |
| Guest controls and help text | Built |
| Guest screen | In progress |
| Access time and bandwidth limits | Depends on model; support detection still being built |
