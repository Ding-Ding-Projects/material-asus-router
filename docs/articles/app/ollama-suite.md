---
title: Ollama suite
category: app
order: 31
summary: Planned: connect to a local Ollama model server to ask questions about your network.
status: in-progress
related: app/file-converter, safety/encrypted-vault
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Ollama suite is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

If you run a local Ollama server, ask it to explain a log excerpt or a setting in plain words, with the data staying on your own network.

## Planned behaviour

- Enter the address of your own Ollama server and choose a model.
- Select a log excerpt or a setting and ask for an explanation.
- Show clearly what text is being sent before it goes.
- Treat answers as suggestions, with no change applied automatically.

## What is missing

Nothing is built. It also needs an Ollama server that you install and run yourself.

## Good to know

- Model answers can be wrong. Check them before acting.
- The app never sends secret values to a model.
