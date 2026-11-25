---
title: Frequently asked questions
category: reference
order: 4
summary: Short answers about what the app does, what it stores, what is still being built, and what to do when something goes wrong.
status: ready
related: setup/troubleshooting, reference/security-model, start/welcome, wiki:home
---

## Basics

### Does it work with any router?

It is built for Asus routers running stock ASUS firmware or Asuswrt-Merlin, managed over SSH. It reads the model and capabilities from the router, so controls for hardware your router lacks are shown disabled with the reason. Other brands are not supported. Not every model has been tried; the pretend router is the only thing the project can claim to have exercised in full. See [Firmware detection](../setup/firmware-detection.md).

### Do I need Docker?

For the web app, yes: it is published as a Docker image. A Windows desktop app that does not need Docker is planned but not built, see [Windows desktop app](../delivery/desktop-app.md).

### Can I try it without a router?

Yes. Demo mode runs a pretend router. See [Try the demo router](../start/demo-router.md).

### Which features are finished?

Each guide shows a **Ready** or **In progress** badge, and in-progress guides list what is missing. Treat the badge as the answer, not the list of areas in the welcome guide.

## Safety

### Can a change lock me out of the router?

Changes that could cut your connection arm a router-side timed revert (90 seconds by default) before they are applied. If the app cannot reach the router again to cancel it, the router restores the old values by itself. See [Connection-loss guard](../safety/connection-guard.md). No safety net covers every case, so keep the router's own admin page reachable and keep a [backup](../router/backup-restore.md).

### Can I undo a change?

Yes. Every applied change is in the history with its previous values and an undo button. See [Undo changes](../safety/undo-changes.md).

### Why does a reboot ask twice?

A reboot drops everyone's connection, so it needs two confirmations: type the router's exact model name, then press and hold the button.

### Can it brick the router?

The app only changes router settings through the same mechanisms the router's own pages use, and it does not flash firmware by itself. Still, a wrong setting can make the router unusable until reset, so read each preview. The project cannot promise it is impossible to cause a problem.

## Accounts

### Who can see my router?

Anyone who can reach the app's address and has an account. Viewers can read the router's settings but cannot change anything or reveal masked secrets. Operators can also change things and reveal a single secret value. See [People and roles](../setup/people-and-roles.md).

### I forgot the owner password.

There is no email reset. Restore a volume backup from before, or start with a fresh volume and reconnect the router. See [First owner account](../setup/first-owner-account.md) and [Back up the data volume](../setup/backing-up-data.md).

### Is there a cloud account?

No. Nothing is sent to anyone. The app talks only to your router.

## Connection

### Key or password?

The app-generated key. No router password is stored at all. The password method is there for when you cannot add a key yet. See [Connect your router](../setup/connect-router.md).

### What is the fingerprint it asks me to approve?

It identifies the router's SSH host key. Approving it once means the app will refuse a different device that appears at the same address later.

### The app says the host key changed.

See [Troubleshooting](../setup/troubleshooting.md#the-host-key-changed).

### Can I manage the router from outside my home?

Do not open the app's port to the Internet. Use a VPN into your network instead, and keep the app on the inside.

## Running it

### Where is my data?

In the `router-data` Docker volume. See [Back up the data volume](../setup/backing-up-data.md).

### How do I update it?

Run `host.bat` again. See [Update the app](../setup/updating.md).

### Why does it say the port is taken?

Another program uses 8790. Run `host.bat --detached --port 8791`.

### Can it run on a Raspberry Pi?

The image is built for `linux/arm64` as well as `linux/amd64`, so a 64-bit Pi with Docker should work. This has not been verified here.

## Language and privacy

### Is there a Cantonese version?

The documentation site has a Cantonese twin of each guide. Where a guide has no twin, the English one is shown with a notice.

### What does the app collect?

Nothing leaves your network. It stores accounts, your router connection and the change history in your own volume. See [Data and security model](security-model.md).

## Reference

- [API overview](api.md)
- [Environment variables and options](environment-variables.md)
