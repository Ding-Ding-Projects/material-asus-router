---
title: Environment variables and options
category: reference
order: 3
summary: Every setting you can pass to the container, to compose, to host.bat and to the setup script.
status: ready
related: setup/install, setup/one-command-setup, delivery/docker-image
---

There are three layers: the variables the **server** reads inside the container, the variables **compose.yaml** reads from `.env`, and the options of the **scripts**.

## Server (inside the container)

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATA_DIR` | `./data` (`/data` in the image) | Where accounts, the vault and history are kept |
| `PORT` | `8790` | Port the server listens on inside the container |
| `BIND_ADDRESS` | `0.0.0.0` | Address to listen on. Set `127.0.0.1` to accept only local connections |
| `DEMO` | unset | `1` starts the pretend router and preconfigures it |
| `NODE_ENV` | `production` in the image | Standard Node.js mode |
| `APP_VERSION` | set at build time | Version shown by `/health` |
| `SOURCE_REVISION` | set at build time | Source revision of the build |
| `BUILD_DATE` | set at build time | Build time |

Running from source, `node server/index.mjs --demo` is the same as `DEMO=1`.

> [!NOTE]
> Changing `PORT` inside the container does not change the published port. The container health check and the `compose.yaml` port mapping use 8790. To change the port on the host, use `ROUTER_APP_PORT` below.

## compose.yaml (read from `.env` or the shell)

| Variable | Default | Meaning |
| --- | --- | --- |
| `ROUTER_APP_PORT` | `8790` | Port on the host |
| `ROUTER_APP_TAG` | `latest` | Image tag to run |
| `ROUTER_APP_DEMO` | `0` | `1` passes `DEMO=1` to the container |

An example `.env` (an example, not from your system):

```
ROUTER_APP_PORT=8790
ROUTER_APP_TAG=latest
ROUTER_APP_DEMO=0
```

## host.bat and scripts\host.ps1

| Option | Meaning |
| --- | --- |
| `--detached` | Start in the background and return |
| `--logs` | Start and show live status and logs |
| `--stop` | Stop the app and keep its data |
| `--remote user@host` | Use the Docker host over SSH |
| `--port N` | Host port, default 8790 |
| `--tag X` | Image tag, default `latest` |
| `--skip-pull` | Use the image already on the host |
| `--demo` | Use the pretend router |

With no mode option, `host.bat` shows a menu. The last remote target is remembered in `%LOCALAPPDATA%\MaterialAsusRouter\last-remote.txt` on your computer.

Exit codes: `0` success, `1` a failure with a `Failed:` message, `2` an unknown option.

## scripts\setup.ps1

| Parameter | Meaning |
| --- | --- |
| `-NonInteractive` | Do not ask questions |
| `-Port N` | Host port |
| `-Tag X` | Image tag |
| `-Demo` | Use the pretend router |
| `-Remote user@host` | Start on a Docker host over SSH |

It writes `ROUTER_APP_PORT`, `ROUTER_APP_TAG` and `ROUTER_APP_DEMO` to `.env`, keeping any other lines. It never asks for router credentials.

## Things that are not settings

Router credentials, the router address and the timed revert length are **not** environment variables. They are entered in the app and stored in the data volume. The timed revert length is a setting in the app, from 20 to 600 seconds, default 90.

See also [Install](../setup/install.md) and [Docker image and Compose](../delivery/docker-image.md).
