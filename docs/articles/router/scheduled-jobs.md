---
title: Scheduled jobs (Merlin)
category: router
order: 19
summary: Run commands on the router at set times on Asuswrt-Merlin, with a readable schedule and a preview.
status: in-progress
related: router/merlin-extras, router/maintenance, router/logs, setup/firmware-detection
---

Scheduled jobs run a command on the router at times you choose, for example a nightly restart of a service or a weekly cleanup. They use the router's built-in scheduler (cron), which only Asuswrt-Merlin provides.

> [!IMPORTANT]
> **Merlin only.** On stock ASUS firmware this area is shown disabled with the reason "Scheduled jobs need Asuswrt-Merlin firmware". No job can be created there.

> [!NOTE]
> **In progress.** Listing existing jobs is built; adding, editing and removing jobs, and real-router tests, are still being built.

## What you see

| Column | Meaning |
| --- | --- |
| Schedule | When it runs, shown in words (for example "Every day at 03:30") with the raw five-field form beside it |
| Command | What is run |
| Name | A short id for the job so the app can find it again |
| Last result | Whether the last run is known to have succeeded. The router does not always report this, and the app says so when it cannot tell |

## How a schedule is written

A schedule has five fields: minute, hour, day of month, month, day of week.

| Schedule field text | In words |
| --- | --- |
| 30 3 * * * | Every day at 03:30 |
| 0 */6 * * * | Every six hours, on the hour |
| 0 4 * * 0 | Every Sunday at 04:00 |
| 15 2 1 * * | On the first of every month at 02:15 |

The editor lets you build the schedule from menus, and shows the words and the next few run times before you confirm.

> [!TIP]
> The times follow the router's clock and time zone. Check them in [System](system.md) first, or every job runs at the wrong hour.

## Add a job

1. Open **Scheduled jobs** on a Merlin router.
2. Choose **Add job** and pick a schedule.
3. Type the command. Use an absolute path to programs. Jobs run without your shell settings.
4. Give the job a name and review the preview, which shows the job as it will be saved.
5. Confirm. The change is saved and the scheduler reloads.

> [!WARNING]
> A job runs with the router's full privileges. A typing error such as a wrong path in a delete command can break the router. Test a command by running it by hand in a safe way first, and never paste a command you do not understand. Jobs that restart the router or its services are best set for quiet hours.

## Edit, disable or remove

Disable a job instead of removing it while you test. Every edit is saved to history so that it can be undone. See [Undo](../safety/undo-changes.md).

## Persistence

On Merlin, user jobs are saved in a way that survives a restart. The app checks this after saving and warns you if it cannot confirm the job is still there. Jobs that need a USB drive stop working if the drive is missing.

## Status

| Part | State |
| --- | --- |
| List existing jobs on Merlin | Built |
| Add, edit and remove | In progress |
| Next-run preview | In progress |
| Real-router test | Not yet |

## Go deeper

- [Cron jobs on Merlin](../merlin/cron-jobs.md)
- [Scheduled reboot](../merlin/scheduled-reboot.md)
