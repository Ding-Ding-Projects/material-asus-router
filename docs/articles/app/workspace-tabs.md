---
title: Workspace tabs and New tab catalog
category: app
order: 14
summary: Planned: keep several areas open as tabs and open any screen from one catalog.
status: in-progress
related: app/command-palette, app/search-and-regex-builder
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Workspace tabs and New tab catalog is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Work on Wi-Fi in one tab while checking the log in another, and open any screen from a searchable catalog.

## Planned behaviour

- Each area opens in its own tab, and reselecting it focuses the existing tab.
- A New tab button opens a catalog of every screen and tool, with its own search.
- Unsaved drafts stay with their tab.
- Closed tabs can be reopened, and tabs are remembered after you reload.

## What is missing

Tabs and the catalog are not built. Today each area is a single screen.

## Good to know

- Tabs are keyboard reachable.
- A change preview in one tab never applies by itself because another tab changed.

## A planned walkthrough (demonstration)

You are comparing two Wi-Fi bands while checking the log for radar events.

1. Open **Wi-Fi** in a tab and **Logs** in another. Each keeps its own scroll position and any unsaved edit.
2. Use the new-tab catalog to open **Devices** without leaving either.
3. Close a tab with unsaved changes and the app asks before it discards anything.

## Questions people ask

**Will opening a menu create more tabs?** No. A tab opens only when you ask for one.

**What if I close a tab by mistake?** Reopen it from the catalog. Tabs hold your place and drafts, not router settings, so closing one never changes the router.
