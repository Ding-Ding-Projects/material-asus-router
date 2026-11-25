---
title: Entware
category: merlin
order: 8
summary: Add a package manager and thousands of extra programs to Merlin using a USB drive, and what it costs in memory and risk.
status: in-progress
related: merlin/addons, connect/usb-apps, merlin/merlin-scripts, router/merlin-extras
---

Entware is a community software repository for small routers. It gives the router a package manager, `opkg`, so you can install programs the firmware does not include: monitoring tools, a lightweight web server, a better text editor. Packages are installed on a USB drive, not in the router's tiny internal storage.

> [!NOTE]
> **In progress.** The app does not install Entware. This guide explains what it is and what to know first. Entware is community software, not made by ASUS or by this project.

## What you need

| Need | Why |
| --- | --- |
| Asuswrt-Merlin with custom scripts enabled | The startup hook mounts Entware at boot |
| A USB drive formatted ext4 | Packages need a Unix file system. See [USB apps](../connect/usb-apps.md) |
| A model on Entware's supported list | The right build must exist for the router's processor |

## How it is usually installed

Most people use a helper menu such as `amtm`, a community tool for Merlin that installs Entware and several add-ons with guided steps. The install formats or prepares the drive, downloads the package manager and adds a small script to start it at boot. Follow that tool's own instructions.

## Using it

```sh
opkg update
opkg list | grep nano
opkg install nano
```

Search, then install by name. Remove with `opkg remove`.

## What it costs

- **Memory.** Every running program uses some of the router's small RAM. Install only what you will use.
- **Reliability.** The router now depends on the USB drive being present. A failed or unplugged drive means the programs vanish at the next boot. The router itself still routes.
- **Security.** Extra programs are extra things to keep updated. A service that listens on the network is a door. Keep it off the internet.
- **Wear.** Heavy writes can shorten a cheap drive's life. Use a decent one.

## Safe habits

1. Start with one package and see how the router behaves.
2. Do not run network services you do not need.
3. Update packages from time to time, with `opkg update` then `opkg upgrade`.
4. Keep the drive plugged in. Use safe eject before you remove it.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Installing or managing Entware from the app | Not planned for the first release |
