---
title: Docker image and Compose
category: delivery
order: 1
summary: What is in the published image, how compose.yaml runs it, and how it is hardened.
status: in-progress
related: setup/install, delivery/releases, reference/environment-variables
---

> [!NOTE]
> The workflow that builds and publishes the image is in the repository. This guide describes how the image and Compose file are set up. Whether a particular tag is published at the time you read this is something to confirm with `docker pull`, see [Releases and verification](releases.md). What is missing here: a checked, published release to point at.

## The image

`ghcr.io/ding-ding-projects/material-asus-router`

| Property | Value |
| --- | --- |
| Base | `node:24.22.1-bookworm-slim`, pinned by digest |
| Platforms | `linux/amd64` and `linux/arm64` (so it also runs on a Raspberry Pi class host) |
| Port | `8790` |
| User | Non-root `node` |
| Data | Volume at `/data` |
| Entry point | `node server/index.mjs` |
| Dependencies | Installed with `npm ci --omit=dev --ignore-scripts` |

The image holds only the server and the built static pages. It has no router credentials in it. Credentials are created later inside the data volume.

### Tags

| Tag | Meaning |
| --- | --- |
| `latest` | Newest build from the main branch |
| `0.1.0` (the version in `package.json`) | A specific version |
| `sha-<12 characters>` | The exact source revision |

The image carries standard labels for title, description, source, license (MIT), revision, creation date and version.

## compose.yaml

The tracked `compose.yaml` runs one service called `asus-router`.

| Setting | What it does |
| --- | --- |
| `image` | `ghcr.io/ding-ding-projects/material-asus-router:${ROUTER_APP_TAG:-latest}` |
| `ports` | `${ROUTER_APP_PORT:-8790}:8790` |
| `environment: DEMO` | `${ROUTER_APP_DEMO:-0}`; `1` starts the [pretend router](../start/demo-router.md) |
| `volumes` | Named volume `router-data` at `/data` |
| `restart` | `unless-stopped` |
| `stop_grace_period` | 20 seconds, so a write in progress finishes |
| `read_only` | The root file system is read-only; `/tmp` is a memory file system |
| `cap_drop` | `ALL` Linux capabilities dropped |
| `security_opt` | `no-new-privileges:true` |
| `healthcheck` | Fetches `/health` every 30 seconds, 5 second timeout, 3 retries |

The `.env` file written by [One-command setup](../setup/one-command-setup.md) supplies `ROUTER_APP_PORT`, `ROUTER_APP_TAG` and `ROUTER_APP_DEMO`.

## Running without host.bat

```
docker compose pull
docker compose up -d
docker compose logs -f asus-router
docker compose stop
```

`host.bat` adds checks and a clear address on top of these. See [Install](../setup/install.md).

## The health endpoint

`GET /health` needs no sign-in and returns the version and a coarse router state (`none`, `configured` or `connected`). It never returns credentials. See [API overview](../reference/api.md).

## Networking

The container needs to reach the router's address over TCP on its SSH port, and nothing else. Publish the port on a trusted network only. See [Data and security model](../reference/security-model.md).

## Build it yourself

```
docker build -t material-asus-router --build-arg APP_VERSION=0.1.0 .
```

Use `ROUTER_APP_TAG` or `--tag` with the name you built, plus `--skip-pull` on `host.bat`, to run a local build.
