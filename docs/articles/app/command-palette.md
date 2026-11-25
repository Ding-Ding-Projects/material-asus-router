---
title: Command palette
category: app
order: 16
summary: Planned: press a shortcut, type what you want and jump there.
status: in-progress
related: app/context-menus-and-shortcuts, app/workspace-tabs
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Command palette is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Open any screen, setting or action by typing a few letters, without hunting through menus.

## Planned behaviour

- Opens with a keyboard shortcut and a visible button.
- Searches screens, settings and common actions.
- Shows the shortcut next to each result.
- Respects your role, so it never offers an action you cannot take.

## What is missing

The palette and its index of actions are not built.

## Good to know

- The palette starts an action; it never applies a change without the usual preview.
- It works with a screen reader.

## A planned walkthrough (demonstration)

You want to rename a device. Without the palette you would open **Devices**, find the row and open its menu. With it:

1. Press the shortcut. The built-in version of the palette is opened with Ctrl+K (Cmd+K on a Mac). See [Keyboard shortcuts](../reference/keyboard-shortcuts.md).
2. Type `rename`. Matching actions and screens appear, in English and Cantonese.
3. Use the arrow keys, then Enter. You land on the device list with the rename field ready.

The palette only **starts** something. A change still goes through the preview and confirmation.

## Questions people ask

**Does it list things my role cannot do?** No. A viewer sees only what a viewer may open.

**Can I use it with a screen reader?** Yes. Results are announced as you move, and Esc closes it and returns focus.
