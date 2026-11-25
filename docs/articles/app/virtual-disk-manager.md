---
title: Virtual disk manager
category: app
order: 33
summary: Planned: create and inspect virtual disk files on the machine running the desktop app.
status: in-progress
related: router/usb-storage
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Virtual disk manager is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

A side feature of the Windows desktop app for working with virtual disk files, separate from the router's USB storage screen.

## Planned behaviour

- List, create and attach virtual disk files on the local machine.
- Show clearly which disk an action will affect before it runs.
- Require explicit confirmation for anything that erases data.
- Not available in the Docker version.

## What is missing

Nothing is built. It depends on the desktop app, which is itself planned in the same release.

## Good to know

- This works on the computer, not on the router.
- Actions that erase data always name the exact target.
