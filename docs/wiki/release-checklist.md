---
title: Release checklist
order: 5
summary: What must be true, and be read back, before a version is published.
---

A release is a promise about what people can download. This checklist keeps the promise honest. Tick an item only after you have checked it, and note anything you could not check.

## Before building

- [ ] The change history of the version is written, and anything unfinished is labelled **In progress**.
- [ ] The tests pass with `npm test`.
- [ ] The documentation builds with `node scripts/build-site.mjs site` and the build prints no errors.
- [ ] The publication language scan passes, because the repository is public.
- [ ] No private address, real personal name or credential appears in any file, including the documentation examples, which use `198.51.100.1`, `198.51.100.0/24`, Pat and Alex.

## Build and publish

- [ ] The Docker image is built from the exact source and tagged with a unique version.
- [ ] The image is published to the container registry, and pulling it by that tag works.
- [ ] The release is a normal release: not a draft and not a pre-release.
- [ ] If a Windows desktop app is part of the version, it is built, attached to the release and named for the same version. See the [desktop app guide](../articles/delivery/desktop-app.md).
- [ ] The documentation PDF for phones is built from the same source and attached.

## Check what you published

- [ ] Read the release back from GitHub and confirm the tag, the target commit and every expected file.
- [ ] Start the published image with `host.bat` or the compose file and confirm the app answers on its port.
- [ ] Try demo mode to confirm the pretend router works on the published image.
- [ ] Open the live documentation site and follow the home page, one guide, one wiki page and the Cantonese switch.
- [ ] Confirm the repository's website field points at the site home page.

## Safety review

- [ ] Every router write still goes through preview, confirm and apply.
- [ ] The connection guard is armed for the changes that need it. See the [guide](../articles/safety/connection-guard.md).
- [ ] Roles are enforced for every new action, and a viewer cannot change anything.
- [ ] No secret value appears in logs, history or exports.

## After publishing

- [ ] Update `ROADMAP.md`: tick only what is built and checked.
- [ ] Update [known limitations](known-limitations.md) so it matches the release.
- [ ] Record what could not be checked, with the reason, in the hand-off notes.

> [!IMPORTANT]
> A published file is not proof that it works. Report published, installed and working as three separate facts.
