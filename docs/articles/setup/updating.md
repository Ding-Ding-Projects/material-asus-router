---
title: Update the app
category: setup
order: 8
summary: Pull a newer image, restart the container and keep your settings, accounts and history.
status: ready
related: setup/backing-up-data, delivery/releases, delivery/docker-image
---

Your settings, accounts, encrypted vault and change history live in the `router-data` volume, not in the container. Updating means replacing the container with a newer image while the volume stays.

> [!TIP]
> Make a copy of the volume first. See [Back up the data volume](backing-up-data.md).

## Update with host.bat

Running `host.bat` again always pulls the image for the chosen tag before starting.

```
host.bat --detached
```

- With the default tag `latest`, this pulls the newest published image.
- To pin a version, pass it: `host.bat --detached --tag 0.1.0`. Pinning is useful when you want updates to happen only when you decide.
- On a remote Docker host add `--remote pat@198.51.100.5`.

The script recreates the container if the image changed, waits for the health check and prints the address. It prints the running version, for example `Material Asus Router 0.1.0 is running on this computer.`

## Update with the one-command setup

Run `scripts\setup.ps1` again. Your earlier answers are the defaults, so you can press Enter through the questions, or use `-NonInteractive`. See [One-command setup](one-command-setup.md).

## Update with Compose directly

```
docker compose pull
docker compose up -d
```

## What to check afterwards

1. Open the address and sign in. Your accounts are unchanged.
2. Open the Overview. The router connection should reconnect by itself, using the pinned host key.
3. Open the change history. Earlier changes and their undo buttons are still there.

If the first screen asks you to create an owner account, the app started with an empty volume: see [Troubleshooting](troubleshooting.md).

## Going back to an older version

Pass the older tag to `--tag`. Older versions may not understand data written by a newer one, so restore the volume backup you made before updating if the older version refuses to start.

## Automatic updates

The app does not update itself. If you use a tool that auto-updates containers, pin a tag rather than `latest` so an update never arrives while you are in the middle of a change.

See [Releases and verification](../delivery/releases.md) for how versions are published and how to check an image.
