---
title: Give the app its own address on the home network
category: setup
order: 3.5
summary: Let the Docker-hosted app take its own address on your home network through a macvlan network, instead of a port on the Docker host.
status: ready
related: setup/install, setup/remote-docker, setup/one-command-setup, delivery/docker-image
---

By default the app is reached on a **port of the computer that runs Docker**, for example `http://198.51.100.5:8790/`. In own-address mode the app instead gets **its own address** on your home network, for example `http://198.51.100.50:8790/`, as if it were a small separate device. Everything else is unchanged: same image, same data volume, same hardening.

It uses a Docker **macvlan** network, which gives a container its own network identity next to the host's network card. The default mode stays the published port; own-address mode is something you choose.

## What you need

| You need | Notes |
| --- | --- |
| Docker on **Linux** | Usually a [remote Docker host](remote-docker.md) such as a mini PC or NAS. Docker Desktop on Windows or macOS cannot give a container an address on your network, and the script says so. |
| A free address | One address on your home network that nothing else uses. |
| The network details | The host's network interface (for example `eth0`), the network in CIDR form (for example `198.51.100.0/24`) and the router's address (for example `198.51.100.1`). The script looks these up for you on a Linux host. |

> [!IMPORTANT]
> Choose an address **outside the router's DHCP pool**, or reserve it for the app in the router. If the router hands the same address to a phone, two devices fight over it and both misbehave. The script refuses an address that already answers, but it cannot see a lease that has not been used yet.

## Start it with host.bat

```
host.bat --remote user@host --lan-ip 198.51.100.50
```

| Option | Meaning |
| --- | --- |
| `--lan-ip 198.51.100.50` | The app's own address. Switches on own-address mode. |
| `--lan-parent eth0` | Network interface of the Docker host. Looked up when left out. |
| `--lan-subnet 198.51.100.0/24` | The home network in CIDR form. Looked up when left out. |
| `--lan-gateway 198.51.100.1` | The router's address. Looked up when left out. |

When a value is left out, the script asks the Docker host over the same SSH connection by running a short-lived helper container on the host's own network. If it cannot work a value out, it asks you for it, or stops with a message when it cannot ask.

Double-click `host.bat` for the menu: after choosing where to run, pick **Its own address on the home network** and type the address.

### What it checks

1. Docker on the Linux host answers, and is not Docker Desktop.
2. The address is free: a short-lived container on the host pings it and reads the neighbour table. An answer, or a known hardware address, stops the start.
3. The app starts and the container reports healthy.
4. From **this computer**, the script fetches `http://198.51.100.50:8790/health` and prints the clickable address.

Own-address mode uses the container's real port `8790`; `--port` does not apply.

## Set it up with the one-command setup

`scripts\setup.ps1` has a step *How should people reach the app?* with the choices *On a port of the computer running it* and *Its own address on the home network*. The address fields are saved to `.env`, and the values from the previous run are the new defaults. Non-interactively:

```
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -NonInteractive -Remote user@host -LanIp 198.51.100.50
```

Add `-LanParent`, `-LanSubnet` and `-LanGateway` to give the network details yourself, and `-PublishedPort` to go back to the published port.

## Using Compose directly

`compose.lan.yaml` is an override that you use **together with** `compose.yaml`:

```
docker compose -f compose.yaml -f compose.lan.yaml up -d
```

| Variable | Meaning |
| --- | --- |
| `ROUTER_APP_LAN_PARENT` | Network interface of the host, such as `eth0`. |
| `ROUTER_APP_LAN_SUBNET` | The network in CIDR form. |
| `ROUTER_APP_LAN_GATEWAY` | The router's address. |
| `ROUTER_APP_LAN_IP` | The app's own address. |
| `ROUTER_APP_LAN_RANGE` | Optional. Limits the network to this range. The default is the app's address alone (`<address>/32`), so Docker never hands that network out to anything else. |

The override removes the published port and attaches the app to the macvlan network. The read-only root file system, dropped capabilities, `no-new-privileges` and the health check through the container's own loopback all stay as in `compose.yaml`. Check the merged result with `docker compose -f compose.yaml -f compose.lan.yaml config`.

## The host cannot reach its own container

This is how macvlan works, not a fault: **the computer running Docker cannot talk to a macvlan container on its own network card.** Every other device on the network can. In practice:

- Open the app from your phone or another computer, not from the Docker host itself.
- When the Docker host is a remote machine, `host.bat` runs from your computer and can check the address. When the Docker host is **this** computer, the script cannot check the address from here, says so, and prints the address to open from another device.
- If you must reach it from the Docker host, add a macvlan "shim" interface on the host. That is advanced network setup outside this app.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "already answers on the network" | Another device uses that address. Pick another. |
| Starts, but another device cannot open it | The Linux host's network card or the switch drops frames from a second hardware address. Some virtual machines and Wi-Fi cards do this. Use a wired interface. |
| The network exists with old settings | Stop the app, then remove the old network with `docker network rm` and start again. |
| Works for a while, then two devices clash | The address is inside the router's DHCP pool. Move it outside, or reserve it. |

The app is meant for your own network. Do not expose its address to the Internet, see [Data and security model](../reference/security-model.md).
