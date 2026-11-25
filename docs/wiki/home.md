---
title: Wiki home
order: 1
summary: Short answers, definitions and project notes for Material Asus Router.
---

The wiki holds short pages: definitions, decisions and notes for people who use, build or maintain Material Asus Router. The longer, task-led guides live in the documentation. Start there if you are new.

## For users

- New here? Read the [welcome guide](../articles/start/welcome.md), then try the [demo router](../articles/start/demo-router.md), which needs no real router.
- Not sure what a word means? Check the [glossary](glossary.md).
- Wondering why something is missing or limited? See [known limitations](known-limitations.md).
- Want to know how changes stay safe? Read [preview, confirm and apply](../articles/safety/safe-changes.md) and the [connection-loss guard](../articles/safety/connection-guard.md).

## Find a guide by task

| I want to | Start with |
| --- | --- |
| Fix a problem I can see | [Troubleshooting by symptom](../articles/reference/troubleshooting-by-symptom.md) |
| Make Wi-Fi faster or steadier | [Roaming](../articles/wireless/roaming.md), [DFS channels](../articles/wireless/dfs-channels.md), [Smart Connect](../articles/wireless/smart-connect.md) |
| Understand my internet connection | [Choosing a connection type](../articles/internet/wan-types.md), [IPv6](../articles/internet/ipv6.md), [DNS over TLS](../articles/internet/dns-over-tls.md) |
| Open a port safely | [Forward a port safely](../articles/security/port-forward-safely.md) |
| Harden the router | [Hardening checklist](../articles/security/hardening-checklist.md), [Security deep dive](../articles/security/threat-model.md) |
| Reach home from outside | [Pick a VPN server type](../articles/connect/vpn-servers.md), [WireGuard peers and keys](../articles/connect/wireguard-peers.md) |
| Run scripts or add-ons | [Merlin custom scripts](../articles/merlin/merlin-scripts.md), [Stock or Merlin](../articles/reference/stock-vs-merlin.md) |
| See how the app stays safe | [The guard timeline](../articles/workflows/guard-timeline.md), [The SSH action catalogue](../articles/workflows/ssh-action-catalogue.md) |

## For contributors

- Why the app works the way it does: [design decisions](design-decisions.md).
- How to set up, change and propose work: [contributor guide](contributor-guide.md).
- What must be true before a version is published: [release checklist](release-checklist.md).

## What the project is

Material Asus Router is a self-hosted web app that manages an Asus router over SSH. It works with stock ASUS firmware and with Asuswrt-Merlin, detects which one you have and shows Merlin-only controls as disabled, with the reason, on stock firmware. A Windows desktop app is planned in the same release.

## How to read the status labels

| Label | Meaning |
| --- | --- |
| Ready | Built and checked. Safe to rely on. |
| In progress | Being built. The page says what is missing. Do not rely on it yet. |

Most pages are **In progress** at this stage, and each says plainly what that means for it.

## Other places

- Source and issues: <https://github.com/Ding-Ding-Projects/material-asus-router>
- This site: <https://ding-ding-projects.github.io/material-asus-router/>
