---
title: Try the demo router
category: start
order: 4
summary: Use the built-in pretend router to try the whole app without owning an Asus router.
status: ready
related: setup/install, safety/safe-changes, reference/faq
---

Demo mode starts a **pretend Asus router** inside the app. It speaks SSH and answers the same commands the app sends to a real router, using an in-memory table of settings. You can explore every screen, make changes, undo them and add people without touching a real device.

> [!IMPORTANT]
> Everything shown in demo mode comes from the pretend router, not from your network. Treat any value you see there as an example. Changes you make are not sent anywhere, and they are lost when the app restarts.

## Start it

### With host.bat

```
host.bat --demo
```

Add `--detached` or `--logs` as usual, for example `host.bat --detached --demo`. See [Install](../setup/install.md).

### With the one-command setup

Choose **Pretend router (demo)** on the first question, or pass `-Demo`:

```
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -Demo
```

### With Docker Compose directly

```
ROUTER_APP_DEMO=1 docker compose up -d
```

On Windows PowerShell set the variable first with `$env:ROUTER_APP_DEMO = '1'`.

### Without Docker

Run the server from the source tree with `node server/index.mjs --demo`, or set `DEMO=1`.

## What demo mode does

- Creates a pretend router at an internal address and **preconfigures** the connection, including its host key, so you skip the connect step.
- Presents a Merlin-flavoured router by default, so you can see Merlin-only controls enabled. The same pretend router can also act as stock firmware, which is how the disabled-with-a-reason behaviour is tested. See [Firmware detection](../setup/firmware-detection.md).
- Still asks you to create the first account, which becomes the owner, so you can try roles too.

## What it does not do

| It does not | Why |
| --- | --- |
| Reflect your real network | The pretend router has its own made-up devices and settings. |
| Keep changes after a restart | The pretend settings table lives in memory. |
| Prove your router will behave the same | Real firmware varies by model and version. |

## A good first session

1. Create the owner account.
2. Open **Overview** and note the model and firmware flavour.
3. Open **Wi-Fi**, change the network name, preview, confirm, apply.
4. Open the change history and undo that change.
5. Add a viewer from the people screen, sign in as that viewer in a private window, and notice that changing anything is refused.

## Moving to a real router

Stop the demo, run [One-command setup](../setup/one-command-setup.md) again and choose **My real Asus router**, then follow [Connect your router](../setup/connect-router.md). Your demo account and history stay in the data volume unless you delete it; see [Back up the data volume](../setup/backing-up-data.md).
