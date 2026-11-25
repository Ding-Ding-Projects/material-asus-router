---
title: Cron jobs on Merlin
category: merlin
order: 7
summary: Schedule commands to run at set times, the five-field time format, how to make them survive a reboot, and a worked example.
status: in-progress
related: router/scheduled-jobs, merlin/merlin-scripts, merlin/scheduled-reboot
---

Cron is the classic Unix scheduler. On Asuswrt-Merlin you add jobs with a small command called `cru`. The app reads the current job list (see [Scheduled jobs](../router/scheduled-jobs.md)). Editing jobs from the app is planned. On stock firmware this feature is not available and the app says so.

## The time format

A schedule is five fields: minute, hour, day of month, month, day of week.

```text
 ┌ minute (0-59)
 │ ┌ hour (0-23)
 │ │ ┌ day of month (1-31)
 │ │ │ ┌ month (1-12)
 │ │ │ │ ┌ day of week (0-7, 0 and 7 are Sunday)
 * * * * *
```

| Schedule | Meaning |
| --- | --- |
| `30 4 * * *` | Every day at 04:30 |
| `0 3 * * 1` | Every Monday at 03:00 |
| `*/15 * * * *` | Every 15 minutes |
| `0 22 1 * *` | The first day of each month at 22:00 |

Times follow the router's clock. Check the time zone and time server in [System](../router/system.md).

## Add a job

```sh
cru a NightLog "30 4 * * * /jffs/scripts/night-log.sh"
cru l
```

`cru a` adds a job with a name and `cru l` lists them. To remove it, run `cru d NightLog`.

## Make it survive a reboot

Jobs added with `cru` are held in memory and vanish at restart. Add the `cru a` line to a startup script such as `services-start` so it is recreated each time. See [Merlin custom scripts](merlin-scripts.md).

## Good habits

- Name every job so the list is readable.
- Do not stack several heavy jobs at the same minute.
- Give each job a log line, using `logger`, so you can see that it ran.
- Test the script by hand before scheduling it.
- Avoid jobs that restart Wi-Fi often. See [Scheduled reboot](scheduled-reboot.md).

## Status

| Part | State |
| --- | --- |
| Reading the job list | Built |
| Add, edit and remove jobs | Planned |
