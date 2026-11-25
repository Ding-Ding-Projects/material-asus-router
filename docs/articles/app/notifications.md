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

## A planned walkthrough (demonstration)

You apply a Wi-Fi change under the guard.

1. A toast says "Change saved. Waiting for the router" and does not block anything you are doing.
2. A second message says "Reached the router. The change stays" or "Could not reach the router. It will revert in 90 seconds".
3. Both appear in the notification list, so a message you missed is still there.

## Kinds of message

| Kind | Example | Stays until |
| --- | --- | --- |
| Result | Applied, undone | Clears itself |
| Warning | Router clock looks wrong | You dismiss it |
| Router event | A new device joined | You dismiss it |

## Questions people ask

**Will it interrupt me?** No dialog is used for routine news. Only a confirmation you asked for takes the screen.

**Is colour the only signal?** No. Every message has words and an icon.
