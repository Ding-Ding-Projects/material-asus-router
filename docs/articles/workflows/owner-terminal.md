---
title: The owner terminal
category: workflows
order: 5
summary: A planned, owner-only terminal for tasks outside the action catalogue, with the guard rails it needs to be safe.
status: in-progress
related: workflows/ssh-action-catalogue, safety/roles-and-access, safety/super-confirmation, reference/security-model
---

The [action catalogue](ssh-action-catalogue.md) covers what the app is built to do. Sometimes an expert needs something else: read a file, test a command, edit a script. The **owner terminal** is the planned answer, kept apart from the normal screens so the safe path stays safe.

> [!NOTE]
> **In progress.** The owner terminal is not built. This page is the design, so you can judge whether you want it.

## Who may use it

Only the **owner** role. Operators and viewers never see it, and the server refuses terminal requests from them whatever the browser sends. See [Roles and access](../safety/roles-and-access.md).

## The guard rails it needs

| Rail | Why |
| --- | --- |
| Off by default, switched on by the owner in Settings | Nobody finds it by accident |
| A fresh password prompt every session | A left-open browser cannot be used |
| Two-step confirmation to start | Same as a reboot. See [Super confirmation](../safety/super-confirmation.md) |
| A visible banner while it is open | You always know a raw shell is live |
| Idle timeout | An abandoned session closes itself |
| Every command recorded in the change history | A record of who ran what and when. Secrets are masked |
| A warning before known-destructive commands | Erasing storage or resetting settings is called out first |
| Shown only over a pinned host key | See [Host key pinning](../safety/host-key-pinning.md) |

## What it will not do

- It will not bypass the connection-loss guard for you. A command that cuts your connection cuts it. Plan a way back first.
- It will not hide commands from the history.
- It will not make unsafe things safe. A terminal is a power tool.

## Instead of the terminal

Most needs are served better elsewhere:

| Need | Use |
| --- | --- |
| Read settings | **Advanced** lists them, with secrets masked |
| Change one | The catalogue-backed change path, with preview and undo |
| Run a script at an event | [Merlin scripts](../merlin/merlin-scripts.md) |

## Status

| Part | State |
| --- | --- |
| Design and guard rails | Written |
| Owner terminal | Planned |
