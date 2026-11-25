---
title: Windows desktop app
category: delivery
order: 2
summary: The planned Windows desktop version of the app, and what is and is not built yet.
status: in-progress
related: delivery/docker-image, delivery/releases, setup/install
---

> [!IMPORTANT]
> **In progress.** The Windows desktop app is planned for the same release as the web app but is not built yet. Nothing on this page describes something you can download today. Use the Docker version, see [Install](../setup/install.md).

## What it will be

The desktop app is meant to give the same screens and the same safety behaviour as the web app, in a normal Windows window, for people who do not want to run Docker.

| Goal | Plan |
| --- | --- |
| Same areas and same safe-change flow | Share the app's screens and rules with the web version, so a change behaves identically in both |
| No Docker needed | Run the app's server inside the desktop app |
| Same router connection model | App-generated SSH key or password, host key approved once and pinned, credentials stored encrypted |
| Same accounts and roles | The first account is the owner, with operators and viewers |
| Demo mode | The pretend router, so you can try it without a router |

## What is missing

- No installer or portable file has been built.
- No signed or verified release exists.
- How the desktop app stores its data, and how it updates itself, are not decided.
- Whether other people on the network can sign in to a desktop copy is not decided. The web version is the one meant to be shared.

## What to use today

| If you want | Use |
| --- | --- |
| The app running on your own computer | [Install with Docker and host.bat](../setup/install.md) on that computer, then open `http://127.0.0.1:8790/` |
| It running on a small server or NAS | [Remote Docker host](../setup/remote-docker.md) |
| To try without a router | [Demo router](../start/demo-router.md) |

## When it is ready

This page will change to **Ready** only after a desktop build has been installed, started and checked against the demo router and a real router. Its release page will state the version and give the way to verify the download, see [Releases and verification](releases.md).
