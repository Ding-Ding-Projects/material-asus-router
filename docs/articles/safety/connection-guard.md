---
title: The connection-loss guard
category: safety
order: 2
summary: A router-side timer restores the old values by itself if a risky change cuts the app off.
status: in-progress
related: safety/safe-changes, safety/undo-changes, safety/change-history, wiki:design-decisions
---

Some changes can cut the link between the app and the router: a new router address, a different DHCP range, a Wi-Fi restart on the network you are connected through, or a firewall rule. If that happens, the app cannot send a "put it back" command. The connection guard solves this by putting the rescue on the router itself.

> [!NOTE]
> The guard builder, the timer command and the cancel commands are implemented in `server/changes/guard.mjs`. Testing against a real router across every kind of change is still in progress, and the pretend router only simulates the timer.

## How it works

Before the change is written, the app sends the router a small script that restores the previous values, commits them, restarts the same services and then deletes itself. A background timer on the router waits for the delay and then runs that script. If the app can still reach the router after the change, it cancels the timer. If not, nobody has to do anything: the router restores itself.

```text
 App                                   Router
  |                                      |
  | 1. save previous values              |
  | 2. send revert script + start timer ->  timer: 90 s  (background)
  | 3. write new values, commit, restart -> new settings live
  |                                      |
  | 4. reconnect and read a value back   |
  |        |                             |
  |   reachable?                         |
  |     yes -> 5a. cancel timer --------->  timer stopped, script removed
  |     no  -> 5b. (app is cut off)         timer fires: old values restored,
  |                                         services restarted, script removed
  v                                      v
```

## Step by step

1. **Previous values are saved** in the change history.
2. **The guard is armed.** The script is sent in encoded form to a temporary folder on the router and a timer starts. The default delay is 90 seconds; the allowed range is 5 to 900 seconds.
3. **The change is applied** and the affected services restart.
4. **The app tries to reach the router again** and reads a value back to confirm the change took effect.
5. **The guard is cancelled** when the router answers, or **fires** by itself when it does not.

## When the guard is armed

| Change | Guard |
| --- | --- |
| Router address, subnet, DHCP range | Armed |
| Wi-Fi settings on the band you use | Armed |
| Firewall and port forwarding rules | Armed |
| Internet connection type and DNS | Armed |
| Display names and labels | Not needed |
| Reboot | Not used; see [two-key confirmation](super-confirmation.md) |

## What you will see

While the timer runs, the app shows a countdown and the sentence "If this page cannot reach the router, it will go back by itself." If the app reconnects, you get a short confirmation. If the router reverted, open the app again after the delay and the [history](change-history.md) marks the change as **reverted by the guard**.

> [!WARNING]
> The guard protects against losing contact. It does not protect against a setting that works but is wrong, such as a bad Wi-Fi password. Check the preview carefully, and use [undo](undo-changes.md) if needed.

## Limits

- The router must be running when the timer is armed. A power cut during the delay can leave the router with half-applied values.
- If the router's clock or shell is unusual, the timer might not start. The app checks that the timer started and refuses to apply if it did not.
- Setting the delay too short may revert a slow but successful change. Keep the default unless you have a reason.

## See it in action

::sim[change-guard]

*The panel above is a demonstration with made-up values. It does not read or change your router.*

## Go deeper

- [The guard timeline, step by step](../workflows/guard-timeline.md)
