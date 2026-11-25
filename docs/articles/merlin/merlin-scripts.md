---
title: Merlin custom scripts
category: merlin
order: 6
summary: Run your own small scripts at router events such as startup or a firewall restart, and the rules that keep them from breaking the router.
status: in-progress
related: router/merlin-extras, merlin/cron-jobs, merlin/entware, setup/firmware-detection
---

Asuswrt-Merlin can run your own shell scripts when the router does certain things. This is what turns the router into something you can tailor. The app has a switch for **Run custom scripts** under Merlin extras. It is disabled, with the reason, on stock firmware.

> [!WARNING]
> A script runs on the router with full power. A mistake can lock you out of the network or stop it routing. Keep scripts small, test them, and never paste code you do not understand.

## Where they live

Custom scripts live in the router's permanent storage folder, `/jffs/scripts`. A script is run when its **name** matches an event:

| Script name | Runs when |
| --- | --- |
| `services-start` | The router finishes starting up |
| `firewall-start` | The firewall is built or rebuilt |
| `wan-event` | The internet connection comes up or goes down |
| `post-mount` | A USB drive has been mounted |
| `dhcpc-event` | The router renews its address from the provider |

Each file needs the first line `#!/bin/sh` and must be marked executable.

## A first script (demonstration)

Blink-free and harmless: write one line to the router log at startup.

```sh
#!/bin/sh
# /jffs/scripts/services-start
logger -t "my-script" "Router started, scripts are working"
```

Mark it executable and reboot:

```sh
chmod a+rx /jffs/scripts/services-start
```

Then look for the line in the [log](../router/logs.md). If it appears, scripts are working.

## Rules that save you

1. **Enable custom scripts first.** The switch is under Merlin extras. A script does nothing until it is on.
2. **One job per script**, and never an infinite loop at startup. A script that never ends stops the rest of startup.
3. **Run slow jobs in the background** with an ampersand at the end of the line.
4. **Keep a way back.** Before a firewall script, know how to remove it from another device. A faulty `firewall-start` can lock out the app.
5. **Back up** `/jffs/scripts` with the router [backup](../router/backup-restore.md).
6. **Use full paths** for commands. The environment is bare.

## Where the app helps

The app can switch scripts on or off and show the folder state. An editor and a safe-test mode are planned. It will never run a script you have not previewed.

## Status

| Part | State |
| --- | --- |
| Custom-scripts switch | Built (Merlin only) |
| Script editor and safe test | Planned |
