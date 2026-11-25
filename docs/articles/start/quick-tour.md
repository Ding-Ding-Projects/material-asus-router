---
title: Quick tour
category: start
order: 3
summary: A walk through the app from first start to your first safe change.
status: in-progress
related: start/demo-router, setup/install, setup/connect-router, safety/safe-changes
---

This tour follows the order you will meet things the first time. No screenshots appear here yet because the guide only uses real captures from a verified build; they will be added when those exist.

## 1. Start the app

Run the one-command setup or `host.bat`, then open the address it prints, for example `http://198.51.100.5:8790/`. See [Install](../setup/install.md) and [One-command setup](../setup/one-command-setup.md).

## 2. Create the owner account

The first screen asks you to create an account. The first account becomes the **owner**. There is no setup code, so do this before anyone else on your network can reach the page. See [First owner account](../setup/first-owner-account.md).

## 3. Connect the router

The setup screen asks for the router's address, its SSH port (22 unless you changed it), its SSH user name and how to sign in:

- **App-generated SSH key** (the default). The app makes a key pair and shows the public half for you to allow on the router.
- **Router password**, typed only on this screen and stored encrypted.

The first time the app connects it shows the router's **host key fingerprint**. You approve it once and the app pins it. See [Connect your router](../setup/connect-router.md).

## 4. Read the Overview

The Overview shows the model, firmware flavour, uptime and WAN state. The app also decides here whether the router runs stock ASUS firmware or Asuswrt-Merlin. See [Firmware detection](../setup/firmware-detection.md).

## 5. Make a first change

1. Open an area, for example Wi-Fi, and edit a value.
2. Choose to preview. You see each setting with its old and new value.
3. Confirm. The previous values are saved.
4. If the change could cut your connection, the app first arms a router-side timer that restores the old values after 90 seconds, then applies the change, then cancels the timer once it reaches the router again.

Read [Make changes safely](../safety/safe-changes.md).

## 6. Undo

Open the change history and choose undo on any applied change. See [Undo changes](../safety/undo-changes.md) and [Change history](../safety/change-history.md).

## 7. Add people

The owner can add operators and viewers from the people screen. See [People and roles](../setup/people-and-roles.md).

## Try it without a router

Every step above also works against the built-in pretend router. See [Try the demo router](demo-router.md).

> [!NOTE]
> Some areas are still being built. A guide with the **In progress** badge lists what is missing.
