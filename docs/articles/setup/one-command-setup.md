---
title: One-command setup
category: setup
order: 2
summary: Answer a few questions in a terminal menu and let the setup script write the settings and start the app.
status: ready
related: setup/install, setup/remote-docker, start/demo-router
---

`scripts/setup.ps1` is the shortest route from a fresh clone to a running app. It asks only for what it cannot choose itself, picks the rest, writes a `.env` file, starts the app with `host.ps1` and prints the working link.

## Run it

```
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

## The questions

The interactive menu uses the arrow keys, **Enter** to choose and **Backspace** to go back. When input is redirected it falls back to numbered lines.

1. **Real router or pretend router.** Choose *My real Asus router* or *Pretend router (demo)*.
2. **Port.** The suggestion is the first free port from 8790 upward. Enter a number from 1024 to 65535.
3. **Review.** The script lists `ROUTER_APP_PORT`, `ROUTER_APP_TAG` and `ROUTER_APP_DEMO`. Choose *Start the app*, or go back to change something.

> [!IMPORTANT]
> The setup script never asks for your router password. Router credentials are typed only in the app's own setup screen, see [Connect your router](connect-router.md).

## What it writes

A `.env` file in the repository root:

| Key | Meaning | Default |
| --- | --- | --- |
| `ROUTER_APP_PORT` | Port published on the host | first free port from 8790 |
| `ROUTER_APP_TAG` | Image version | `latest` |
| `ROUTER_APP_DEMO` | `1` for the pretend router | `0` |

Lines you added to `.env` yourself are kept. Run the script again to reconfigure: values from the previous run are the new defaults.

## Non-interactive use

For scripts and automation, skip the questions:

```
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -NonInteractive -Port 8790 -Tag latest
```

| Parameter | Meaning |
| --- | --- |
| `-NonInteractive` | Never ask; use parameters, saved values and defaults. |
| `-Port 8790` | Host port. |
| `-Tag 0.1.0` | Image version. |
| `-Demo` | Use the pretend router. |
| `-Remote user@host` | Start on a Docker host over SSH, see [Remote Docker host](remote-docker.md). |

## After it finishes

The script starts the app in the background through `host.ps1 --detached`, waits for the health check and prints `Open: http://<address>:<port>/`. Open that link and [create the owner account](first-owner-account.md).

If it stops with `Failed:` followed by a reason, the same reasons and fixes are listed in [Troubleshooting](troubleshooting.md).
