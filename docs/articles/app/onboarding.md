---
title: First-run setup wizard
category: app
order: 27
summary: Planned: a guided first start that creates the owner, connects the router and ends in a working app.
status: in-progress
related: setup/connect-router, start/welcome
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> First-run setup wizard is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Walk through the first start step by step, so you finish with a signed-in owner account, a connected router and the app ready to use.

## Planned behaviour

- Steps: create the owner, enter the router address, approve the host key, choose the sign-in method, confirm the detected firmware.
- Back and Next, with progress saved so you can stop and resume.
- Optional steps can be skipped.
- Finishes on the Overview screen.

## What is missing

The wizard screens are not built. The one-command setup script and the first-account rule exist separately.

## Good to know

- The first account created becomes the owner.
- You can try the pretend router instead of connecting a real one.

## A planned walkthrough (demonstration)

The first start, as a short path:

1. **Create the owner.** A name and a long password. See [First owner account](../setup/first-owner-account.md).
2. **Connect the router.** Enter its address, approve its host key once and choose a key or password. See [Connect your router](../setup/connect-router.md).
3. **Detect the firmware.** The app reads whether it is stock or Merlin. See [Firmware detection](../setup/firmware-detection.md).
4. **Try a safe change.** The app suggests renaming a device, so you see preview, apply and undo once with no risk.
5. **Finish** on the Overview screen.

Each step saves progress, so closing the app does not lose your place.

## Questions people ask

**Can I skip a step?** Optional steps, such as a tour, can be skipped. Creating the owner and connecting the router cannot.

**Can I do it again?** The wizard can be reopened from Settings.
