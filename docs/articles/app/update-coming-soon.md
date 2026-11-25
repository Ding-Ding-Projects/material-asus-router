---
title: Update coming soon
category: app
order: 26
summary: Planned: show progress while a new version is being built, before it is available.
status: in-progress
related: app/changelog
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Update coming soon is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

When a newer version is being prepared but is not published yet, show that it is on its way and how far along it is, instead of nothing.

## Planned behaviour

- Shows the build number and each stage with its own state.
- Shows start time and elapsed time in 24-hour format.
- Labels any estimate as an estimate.
- Becomes the normal update offer once the version is published.

## What is missing

Nothing is built. It depends on a release process that publishes build progress.

## Good to know

- It never installs anything on its own.
- It never invents progress that did not happen.

## A planned walkthrough (demonstration)

While a new version is being built, the app shows an **Update coming soon** card:

| Stage | State |
| --- | --- |
| Build the app | Done |
| Package the Docker image | In progress, started 14:05, 6 minutes so far |
| Publish the release | Waiting |
| Verify the download | Waiting |

The card lists what the version will contain and a labelled estimate. It never shows a made-up percentage, and it changes to the ordinary update offer only when the release is published and verified.

## What it never does

It never installs anything by itself, and it never says an update exists before it does.

## Questions people ask

**Why show it at all?** So you know a fix is coming and can wait instead of working around a known problem.
