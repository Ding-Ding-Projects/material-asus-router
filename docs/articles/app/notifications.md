---
title: Notifications
category: app
order: 18
summary: Planned: non-blocking messages for results, warnings and router events.
status: in-progress
related: app/action-sounds, safety/change-history
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Notifications is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

See short messages such as "Change applied" or "The guard cancelled the revert" without a dialog getting in the way.

## Planned behaviour

- Messages appear in a corner, stay a few seconds and can be dismissed.
- A notification list keeps recent messages.
- Errors stay until dismissed.
- Choose which kinds of message you want.

## What is missing

Neither the message system nor the list is built.

## Good to know

- Messages are announced to screen readers.
- A confirmation you must answer is a dialog, not a notification.
