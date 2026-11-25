---
title: Known limitations
order: 6
summary: What the app cannot do yet, what it cannot do by design, and what depends on your router.
---

This page lists limits honestly so you can decide whether the app fits your situation. It is updated with each release.

## Still being built

The app is under active development. Most areas and almost all of the app's own features are **In progress**. A page marked that way describes a plan and says what is missing. In particular:

- Many on-screen areas are not finished, even where the server side exists. Each area guide in the router section says what is missing.
- The Windows desktop app is planned in the same release and is not available yet. See the [desktop app guide](../articles/delivery/desktop-app.md).
- The planned [network tools](../articles/tools/network-tools.md), such as the speed test and the Wi-Fi channel analyser, are not built.
- The app's extra features, for example language modes, the appearance editor and the command palette, are listed in the app section and are not built.
- Verification against real routers is limited. Most testing uses the pretend router, which only simulates a router.

## Limits by design

- **Not a cloud service.** The app runs on your own network. There is no account with the project, no remote access feature and no hosted version.
- **Do not expose it to the internet.** It is built for a trusted home or office network. If you need remote access, use a VPN to your network.
- **One router per installation.** Managing several routers from one place is not planned yet.
- **SSH must be enabled** on the router. The app cannot turn it on from outside.
- **No access to the vendor cloud.** Settings that exist only in a vendor account or phone app are out of reach.

## Depends on your router

- Stock ASUS firmware has fewer controls than Asuswrt-Merlin. Merlin-only controls are shown disabled with the reason. See [firmware detection](../articles/setup/firmware-detection.md).
- Models differ in the features they have, such as bands, VPN types and USB support. Where the router lacks a feature, the app shows it as unavailable.
- Some values only take effect after a service restart, and a few after a reboot. The preview says which.

## Safety limits

- The [connection guard](../articles/safety/connection-guard.md) cannot help if the router loses power during the delay, and cannot catch a setting that works but is wrong.
- [Undo](../articles/safety/undo-changes.md) restores stored values. It cannot undo a reboot or a firmware update.
- The first connection to a router trusts the host key you approve. Compare the fingerprint when you can. See [host key pinning](../articles/safety/host-key-pinning.md).
- Anyone who can read the whole data volume while the app runs may be able to recover the credentials. See the [encrypted vault](../articles/safety/encrypted-vault.md).

## Documentation limits

- Screenshots appear only after real captures of the built app have been verified. Until then, a clear placeholder is shown.
- Sample outputs in the guides are labelled as examples and are not from your router.

## Reporting a limitation

If you hit a limit that is not listed here, open an issue and say your router model and firmware family. That helps the list grow in the right direction.
