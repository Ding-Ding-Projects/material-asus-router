---
title: The guard timeline, step by step
category: workflows
order: 7
summary: Follow one risky change from preview to safe finish, and see exactly what happens if the connection drops partway.
status: in-progress
related: safety/connection-guard, safety/safe-changes, safety/undo-changes, router/wifi
---

Some changes can cut you off from the router: the Wi-Fi password you are connected with, the router's own address, the firewall. The connection-loss guard handles that. This page walks one such change from start to finish, in the order things happen. The full explanation is in [Connection-loss guard](../safety/connection-guard.md).

::sim[change-guard]

*The timeline above is a demonstration with made-up timings. It does not touch your router.*

## The sequence

| Step | What happens | Who does it |
| --- | --- | --- |
| 1 | You edit a setting. The app shows old and new values | You and the app |
| 2 | You confirm | You |
| 3 | The app saves the previous values | The app |
| 4 | **The router is told to put the old values back after 90 seconds unless cancelled.** This is the safety timer | The router |
| 5 | The app applies the new values | The app |
| 6 | The app tries to reach the router again | The app |
| 7a | It can: it cancels the timer. The change stays | The app |
| 7b | It cannot: nobody cancels, and after 90 seconds the router restores the old values by itself | The router |

Step 4 happens **before** step 5. That order is the whole idea. The safety net is on the router, so it works even if the app, your laptop or the Wi-Fi is gone.

## Two outcomes (demonstration)

**Good outcome.** You change the Wi-Fi password from a wired laptop. The app applies it, reaches the router in 6 seconds and cancels the timer. Your Wi-Fi devices need the new password. Nothing else happens.

**Recovery outcome.** You change the password from a phone on that same Wi-Fi. The phone drops. The app cannot reach the router. After 90 seconds the router puts the old password back. The phone reconnects by itself, and the change history shows "reverted by guard".

## What you can do

- Make risky changes from a wired device.
- Keep the confirmation window open until you have tested.
- Change the 90 seconds in Settings if your router is slow to restart Wi-Fi.

## What it cannot do

- It cannot help if the router loses power, or if the change breaks the router in a way that is not about reachability.
- It does not protect changes made outside the app.

## Status

| Part | State |
| --- | --- |
| Guard engine | Built. End-to-end test on a real router not yet done |
| Guard screens | In progress |
