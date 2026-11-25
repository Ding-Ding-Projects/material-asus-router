---
title: Personal vocabulary file
category: app
order: 4
summary: Planned: load your own word list to change how the app names things, kept on your device.
status: in-progress
related: app/language-modes
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Personal vocabulary file is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Replace the app's wording with your own, for example to use your household's names for rooms or devices, by loading a small JSON file.

## Planned behaviour

- Drop a JSON file anywhere on the window, or choose it in Settings.
- The file is checked completely before anything changes, and a bad file is refused with a reason.
- Clear it at any time to return to the original wording.
- The file stays on your device and is never sent to the server or into exports.

## What is missing

The loader, the checks and the settings control are not built.

## Good to know

- Technical text such as commands, addresses and file names is never replaced.
- School mode suspends a loaded file.

## A planned walkthrough (demonstration)

Your family calls the router "the box". You load a small word list that maps the app's word "router" to "the box".

1. Open the setting and choose your file. The app reads it on your device only.
2. It checks the whole file before using any of it, and shows what it will change. An invalid file is refused with the reason.
3. Labels such as "Router address" now read "The box address".

Clearing the file puts the original wording back at once.

## What stays literal

Commands, setting keys, addresses and anything copied or exported keep their real spelling. Only everyday words are mapped.

## Questions people ask

**Is the file sent anywhere?** No. It stays on your device and is never added to logs, exports or the change history.

**Can it break the app?** It cannot. It changes labels, not behaviour. School mode pauses it.
