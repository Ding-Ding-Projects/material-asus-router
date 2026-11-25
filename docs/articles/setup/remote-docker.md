---
title: Remote Docker host over SSH
category: setup
order: 3
summary: Run the app on a small server or NAS instead of your own computer, using Docker over SSH.
status: ready
related: setup/install, setup/troubleshooting, reference/security-model
---

You can run the app on another machine that has Docker, such as a mini PC or a NAS, and manage it from your own computer. `host.bat --remote` points Docker at that machine through SSH. The app's data volume then lives on the remote host.

> [!NOTE]
> Two different SSH connections are involved. This guide covers the first, from your computer to the Docker host. The second, from the app to the router, is in [Connect your router](connect-router.md).

## Requirements on the Docker host

- Docker with Compose, running.
- An SSH account that can run `docker` commands.
- Key-based SSH login from your computer. `ssh user@host docker info` must work **without a password prompt**, because `host.bat` cannot answer one.
- The host must be on the same network as the router, so the app can reach the router's address.

## Start, watch and stop

Replace `pat@198.51.100.5` with your own target.

```
host.bat --detached --remote pat@198.51.100.5
host.bat --logs --remote pat@198.51.100.5
host.bat --stop --remote pat@198.51.100.5
```

The target must look like `user@host`. The script sets `DOCKER_HOST=ssh://user@host` only for its own run, so it never changes your normal Docker settings.

With the one-command setup, add `-Remote pat@198.51.100.5`. See [One-command setup](one-command-setup.md).

### Using the menu

Run `host.bat` with no options and choose **Another Docker host over SSH**, then type the target. The last target is remembered in `%LOCALAPPDATA%\MaterialAsusRouter\last-remote.txt` on your computer only, never in the repository, and offered next time.

## What happens

1. The script checks Docker on the remote host.
2. It pulls the image **on the remote host**, so the host needs Internet access to `ghcr.io`.
3. It starts the container there and waits for the health check.
4. It finds the host's address and fetches `/health` from your computer, then prints `Open: http://<host>:8790/`.

If the host name is not an IP address, the script resolves it to an IPv4 address and prints that.

## Where the data lives

The `router-data` volume is on the remote host. Back it up there, see [Back up the data volume](backing-up-data.md). Stopping with `--stop` keeps the volume.

## Common problems

| Message | Fix |
| --- | --- |
| `the remote target must look like user@host` | Check the spelling, with no spaces or `ssh://` prefix. |
| `Docker on user@host cannot be reached over SSH` | Run `ssh user@host docker info` yourself. Fix key login first. |
| `the image could not be pulled` | The remote host cannot reach `ghcr.io`, or the `--tag` does not exist. |
| `... does not answer from this computer` | A firewall on the remote host blocks the port. |

More in [Troubleshooting](troubleshooting.md).
