---
title: Kick, ban, unkick and unban
category: lan
order: 6
summary: Pause one device's internet for a while or until lifted, to share the connection fairly. The person on that device can always lift it themselves.
status: in-progress
related: lan/dhcp-pool-planning, safety/change-safety, tools/subnet-calculator
---

**Kick and ban** is for sharing the connection fairly. It pauses one device, never the whole
network, and the person on that device can always lift the pause themselves.

## Kick or ban a device

Open **Kick and ban** (Devices), press **Kick** next to the device, then choose:

- **How:**
  - **Pause internet**: the router drops that device's internet traffic. Things at home, such as a
    printer or a shared drive, keep working.
  - **Block name lookups**: the router stops answering that device's name lookups, so websites and
    most apps stop loading. Anything that uses an address directly still works.
  - **Disconnect from Wi-Fi once**: the device is sent off the Wi-Fi once and can rejoin straight
    away. Nothing stays paused.
- **For how long:** 15 minutes, 30 minutes, 1, 2 or 4 hours, or **Until lifted**. A pause until
  lifted is a ban.
- **A note for them** (optional), such as "Homework first". The paused person sees it.

The sheet shows the impact: level 1, one device. When the device belongs to your brother in the
household list, it says so before you press the button.

## Unkick and unban

- **From the app:** the **Paused now** list has **Unkick** or **Unban** on every pause.
- **From the paused device, without an account:** open the **Unkick page** (`/unkick.html` on the
  app's address). It recognises the device by the address it connects from, shows why it is paused
  and until when, and offers one button. It can only lift the pause on the device you are using,
  and it never shows anyone else's devices. Copy the link from the Kick and ban screen to send it.

Every kick, ban, unkick and unban is recorded with who did it, including "the device itself".

## How it works on the router

The rules live in two firewall chains of the app's own, `MAR_PAUSE` (forwarded traffic, IPv4 and
IPv6) and `MAR_NAMES` (name lookups to the router), so nothing else in the firewall changes. Each
rule matches one device's MAC address. A router restart clears firewall rules, so the app puts
running pauses back and removes finished ones every 30 seconds while the screen is open.

## Limits

- A device that changes its MAC address (private Wi-Fi address) is a new device to the router.
- Name-lookup blocking only covers lookups sent to the router. A device set to use another
  resolver over an encrypted connection is not affected; use **Pause internet** for those.
- Slowing a device down instead of pausing it needs the router's bandwidth limiter, which changes
  the QoS mode for the whole network. It is not offered here yet.
