---
title: Releases and verification
category: delivery
order: 3
summary: How versions are published, and how to check that the image you run is the one you meant.
status: in-progress
related: delivery/docker-image, setup/updating, reference/security-model
---

> [!NOTE]
> **In progress.** The image workflow exists and the site and PDF are built by their own workflows. This guide describes the intended release process. What is missing: a first published and checked release to link to. Check the repository's Releases page and the package page before relying on a tag.

## What a release is

A release is a version number in `package.json`, a matching image on `ghcr.io`, and release notes. The image workflow runs on pushes to the main branch that change the server, the pages, the dependencies or the Dockerfile, and can be run by hand. Each run builds for `linux/amd64` and `linux/arm64` and publishes three tags: the version, `sha-<12 characters>` and `latest`.

## Choose a version to run

| You want | Use tag |
| --- | --- |
| The newest build | `latest` |
| Predictable updates | A version such as `0.1.0` |
| To know exactly which source | `sha-<12 characters>` |

`host.bat --tag 0.1.0` or `ROUTER_APP_TAG=0.1.0` in `.env` selects it.

## Verify the image you run

1. Pull it: `docker pull ghcr.io/ding-ding-projects/material-asus-router:0.1.0`.
2. Read its labels:

```
docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' ghcr.io/ding-ding-projects/material-asus-router:0.1.0
```

3. Compare the revision with the commit in the repository you expected. A match means the image was built from that source.
4. Ask the running app: open `/health` and check the version. Example reply (an example, not from your system): `{"ok":true,"version":"0.1.0","router":"none"}`.

The app also prints its version when `host.bat` reports success.

## Verify the documentation site

The documentation site is built from the Markdown in `docs/` by `node scripts/build-site.mjs site`. The build fails on a broken link, an unknown related slug or an image that is not listed in the evidence manifest, so every page in the published site passed those checks. A phone-size PDF of the same content can be produced with `node scripts/build-pdf.mjs site` when Chrome or Edge is installed.

## What "ready" means in these guides

A guide is marked **Ready** only when its feature is built and has been checked. **In progress** guides say what is missing. A release does not change that: a version number is not proof that a listed area works, so read each area's status badge.

## Reporting a problem

Open an issue and include the version from `/health`, the image tag, your firmware flavour (stock or Merlin) and the exact message. Remove addresses you do not want public, and never include passwords, backups or keys. Security reports follow the repository's `SECURITY.md`.

## Related

[Docker image and Compose](docker-image.md), [Update the app](../setup/updating.md), [Windows desktop app](desktop-app.md).
