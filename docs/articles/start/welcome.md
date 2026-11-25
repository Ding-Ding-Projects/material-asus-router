---
title: Welcome to Material Asus Router
category: start
order: 1
summary: What the app is, how it keeps changes safe, and where to go next.
status: in-progress
related: start/what-it-does, start/demo-router, safety/safe-changes, wiki:home
---

Material Asus Router is a self-hosted web app that manages an Asus router over SSH. It replaces hard-to-read menus with plain labels, and it treats every change as something you should be able to preview, confirm and undo.

> [!NOTE]
> The app is still being built. Each guide carries its own status badge. Anything marked **In progress** says what is missing, and nothing here claims a feature works before it does.

## Who it is for

- People who own an Asus router and want clear names such as "Guest network password" instead of raw setting names.
- Households where one person manages the router and others should only look, never change.
- Anyone who wants a safety net: a preview before every change, a timed revert when a change could cut the connection, and one-click undo afterwards.

## How a change works

Every change follows the same five steps, whichever area you are in.

1. You edit a value on a normal screen.
2. The app shows a readable preview with the old and new values.
3. You confirm. The previous values are saved first.
4. If the change could cut your connection, the router is told to restore the old values after 90 seconds unless the app cancels that timer. The app cancels it once it can reach the router again.
5. The change is applied and recorded in the history, where you can undo it.

Read [Make changes safely](../safety/safe-changes.md) and [Connection-loss guard](../safety/connection-guard.md) for the details.

## What you need

| You need | Why |
| --- | --- |
| An Asus router with SSH turned on | The app talks to the router over SSH. |
| A computer or small server that can run Docker | The app runs as a container. A Windows desktop app is planned, see [Desktop app](../delivery/desktop-app.md). |
| The router's address, such as `198.51.100.1` | The app connects to it. |

You can try everything first without a router, using the built-in pretend router: [Try the demo router](demo-router.md).

## Where to go next

1. [What the app does](what-it-does.md) lists every area.
2. [Quick tour](quick-tour.md) shows the screens in order.
3. [Install](../setup/install.md) gets the app running.
4. [Connect your router](../setup/connect-router.md) links it to your router.

Short answers are in the [wiki](../../wiki/home.md) and the [FAQ](../reference/faq.md).
