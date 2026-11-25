---
title: Search and regex builder
category: app
order: 15
summary: Planned: plain-text search everywhere, with a full regular-expression builder beside it.
status: in-progress
related: app/command-palette, safety/change-history
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Search and regex builder is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Search lists, logs and the change history by plain text, and switch to a pattern builder when you need an exact match.

## Planned behaviour

- Every search box starts as plain text.
- A builder beside it lets you assemble a pattern, choose flags and test it on sample text.
- Invalid patterns show a readable reason, and long-running patterns are stopped.
- Each search remembers its own query and pattern.

## What is missing

Only simple filtering exists in places today. The builder is not built, and how complete it will be is not yet decided.

## Good to know

- Patterns run on your device against data you already have.
- Searching the router log may be limited by how much the router keeps.

## A planned walkthrough (demonstration)

You want every log line that mentions a Wi-Fi device leaving with reason 3 or 4.

1. Type `deauth` in the search box. Plain text finds every line with that word.
2. Switch the box to the regular-expression builder and enter `reason [34]`.
3. The builder shows which part matched, explains the pattern in words and warns about a pattern that could run very long.

| You type | It finds |
| --- | --- |
| `reason 3` as plain text | The exact text |
| `reason [34]`\|4)` as an expression | Either reason |

## Questions people ask

**Do I have to learn regular expressions?** No. Plain text always works, and the builder explains each piece.

**Can a pattern freeze the page?** The builder limits how long a match may run and stops it with a message.
