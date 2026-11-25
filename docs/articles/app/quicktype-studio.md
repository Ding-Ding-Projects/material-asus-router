---
title: Quicktype studio
category: app
order: 30
summary: Planned: turn sample JSON into type definitions for code you write.
status: in-progress
related: app/file-converter, router/advanced
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Quicktype studio is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

For people who script against the router or the app's interface: paste sample JSON and get matching type definitions for a language you choose.

## Planned behaviour

- Paste JSON or load a file.
- Choose a target language and name.
- Copy or download the generated code.
- Warn when the sample is too small to show every field.

## What is missing

Nothing is built, and the languages offered are not decided.

## Good to know

- Generated types describe the sample you give, not the whole interface.
- Never paste data that contains secrets.
