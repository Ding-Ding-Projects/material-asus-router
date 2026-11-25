---
title: Contributor guide
order: 4
summary: How to run the app with the fake router, run the tests, build the site and propose a change.
---

Thank you for helping. This page is the short version; the repository's `CONTRIBUTING.md` is the source of truth if the two ever differ.

## Set up

1. Install Node.js 22 or newer.
2. Clone <https://github.com/Ding-Ding-Projects/material-asus-router> and run `npm install`.
3. Start the app against the built-in pretend router with `npm run demo`, then open `http://localhost:8790/`.

You do not need a real router to work on most of the app. The pretend router also powers demo mode for everyone else.

## Run the tests

```
npm test
```

The tests use the pretend router. If you add behaviour, add a test next to the matching file in `tests/`.

## Ground rules

- Keep every router write inside the change engine: preview, confirm, previous values saved, apply. Do not add a screen that writes directly. See [design decisions](design-decisions.md).
- Never pass browser input to the router shell. Build fixed commands in the server from checked values.
- Interface changes start on the design canvas in `design/canvas/` and are then built to match.
- Every user-facing sentence needs English and Hong Kong Cantonese in traditional characters. Do not machine translate.
- Mark unfinished features **In progress** and say what is missing. Do not describe a plan as a working feature.
- Example addresses in documentation use `198.51.100.1` and `198.51.100.0/24`. Use the names Pat and Alex in examples.
- Label every sample output as an example. Never present invented output as coming from a real router.

## Work on the documentation

Documentation lives in `docs/`. Guides are `docs/articles/<category>/<name>.md` with a Cantonese twin `<name>.zh-HK.md`; wiki pages are `docs/wiki/<name>.md`. The full front matter and link rules are in `docs/README.md`.

Build and check the site:

```
node scripts/build-site.mjs site
```

The build fails on a bad front matter key, a link to a missing page, an unknown related slug or an image that is not a real capture. Fix those before you open a pull request. Screenshots must be real captures listed in `evidence/manifest.json`; never mock one.

## Propose a change

1. Fork, branch from `main`, and make one logical change.
2. Describe in the pull request what behaviour changed and how you verified it.
3. Check that the publication language scan passes, because this repository is public and uses ordinary professional English.

## Security issues

Do not open a public issue for a vulnerability. Follow `SECURITY.md`.

## Related

[Release checklist](release-checklist.md), [known limitations](known-limitations.md), [glossary](glossary.md).
