---
title: Design decisions
order: 3
summary: Why the app previews every change, guards the connection, detects firmware and stores credentials the way it does.
---

These are the main decisions behind the app, with the reason for each. They are written down so that a change that breaks one of them is a conscious choice, not an accident.

## Every router write goes through one change engine

All writes use the same path: preview, confirm, save previous values, apply. Screens never write to the router themselves. This is what makes undo and history possible for every area at once, and it means a new area gets safety for free. Read [preview, confirm and apply](../articles/safety/safe-changes.md).

## The rescue lives on the router

A rescue that runs in the app fails exactly when it is needed, because a bad change often cuts the app off. So the timed revert is a small script and a background timer on the router. The app only has to cancel it. See the [connection-loss guard](../articles/safety/connection-guard.md). The default delay is 90 seconds, a balance between giving a slow router time to settle and not leaving a mistake in place for long.

## Browser input never reaches the router shell

Input from the browser is checked and turned into fixed router commands built by the server. Free-form text is never passed to a shell. This is why the network tools offer a small set of tools, not a command box.

## Firmware is detected, and unavailable controls stay visible

The app reads the router to find out whether it runs stock ASUS firmware or Asuswrt-Merlin. Merlin-only controls on stock firmware are shown disabled with the reason, not hidden. Hiding them makes people think a feature is missing from the app; showing the reason teaches what the router can do. See [firmware detection](../articles/setup/firmware-detection.md).

## SSH key by default, password only when needed

The app generates an SSH key and asks you to install its public half on the router, so the router password never needs to be stored. The password option exists for routers where a key is not practical. Both are kept in the [encrypted vault](../articles/safety/encrypted-vault.md), and the router's host key is approved once and [pinned](../articles/safety/host-key-pinning.md).

## The first account is the owner

A setup code would be one more thing to lose and gives little protection on a freshly started app. Instead the first registration wins atomically and every later attempt is refused. The cost is that the owner account should be created straight after start-up. See [accounts and roles](../articles/app/accounts-and-roles.md).

## Roles are enforced on the server

Hiding a button is not access control. Owner, operator and viewer rules are checked for every request. See [roles and access control](../articles/safety/roles-and-access.md).

## Reboot needs two keys

A reboot cannot be undone and interrupts everyone. It requires typing the exact model and pressing and holding a button, checked on the server. See [two-key confirmation](../articles/safety/super-confirmation.md).

## Advanced shows every router value, friendly label first

Nothing the router stores should be unreachable, but raw keys are unfriendly. The Advanced area lists every value with a readable label first and the raw key second.

## Honest status labels

Pages and features are marked **In progress** until they are built and checked. A page that describes a plan says so. This costs some polish and gains trust.

## The documentation is bilingual

Every guide has an English page and a Cantonese page written for Hong Kong readers, not machine translated. The product, not only the website, is meant to work in both languages.

## Docker first, desktop app planned

The web app ships as a Docker image so it can run on a home server. A Windows desktop app is planned in the same release. See the [desktop app guide](../articles/delivery/desktop-app.md).
