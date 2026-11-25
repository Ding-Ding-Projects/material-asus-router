---
title: Install with Docker and host.bat
category: setup
order: 1
summary: Run the published image on your computer with host.bat, in the background or with a live log view.
status: ready
related: setup/one-command-setup, setup/remote-docker, delivery/docker-image, setup/troubleshooting
---

The app ships as a Docker image. `host.bat` in the repository root pulls that image, starts it with the tracked `compose.yaml`, waits for the health check and prints the address to open. Nothing else needs to be installed besides Docker.

## Before you start

| You need | Notes |
| --- | --- |
| Docker with Compose | Docker Desktop on Windows or macOS, or Docker Engine with the Compose plugin on Linux. It must be running. |
| A copy of the repository | Clone it or download it. The script uses `compose.yaml` next to it. |
| A free port | `8790` by default. |

## Run it

1. Open a terminal in the repository folder.
2. Run `host.bat` with no options to get a keyboard menu, or use one of the options below.
3. Wait for the green line that says the app is running, then open the address after `Open:`.

The script checks that `docker` exists, that Compose works and that the Docker server answers. It pulls the image, starts it, waits up to 90 seconds for the container to report healthy, then fetches `/health` from the printed address to prove it is reachable from this computer.

### The two modes

| Option | What it does |
| --- | --- |
| `host.bat --detached` | Starts in the background, reports health and the address, and returns. |
| `host.bat --logs` | Starts, then shows live status and logs. **F** pauses or resumes following, **S** switches service, **R** refreshes the status line, **Q** or Esc leaves. Leaving never stops the app. |
| `host.bat --stop` | Stops the app. Settings, the encrypted vault and the change history are kept in the data volume. |

Double-clicking `host.bat` opens the menu: pick where to run (this computer, the last SSH target, or another host), then pick to start in the background, start and watch logs, stop, or quit.

### Other options

| Option | Meaning |
| --- | --- |
| `--port 8790` | Port on the host. |
| `--tag 0.1.0` | Image version to pull. The default is `latest`. |
| `--demo` | Use the [built-in pretend router](../start/demo-router.md). |
| `--remote user@host` | Run on another Docker host over SSH, see [Remote Docker host](remote-docker.md). |
| `--skip-pull` | Use an image already on the host instead of pulling. |

## What the address looks like

The script prints the address of this computer on your LAN, for example `http://198.51.100.5:8790/`. Open it from any device on the same network. The app is meant for your own network: do not expose the port to the Internet. See [Data and security model](../reference/security-model.md).

## What compose.yaml sets up

- The image `ghcr.io/ding-ding-projects/material-asus-router`, with the tag from `ROUTER_APP_TAG`.
- Port `8790` published on the host (change it with `ROUTER_APP_PORT`).
- A named volume `router-data` mounted at `/data`.
- A read-only root file system, no extra Linux capabilities, `no-new-privileges`, and a health check.

Details are in [Docker image and Compose](../delivery/docker-image.md).

## Next

[Create the owner account](first-owner-account.md), then [connect your router](connect-router.md). If something fails, see [Troubleshooting](troubleshooting.md).
