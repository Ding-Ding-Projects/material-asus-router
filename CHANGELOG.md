# Changelog

Every release of Material Asus Router, newest first. Each change names the full commit that made it, so the app can check that the commit really exists on GitHub. Entries are factual and are updated in every task that changes the project.

## [Unreleased] - 2026-11-25

### Added

- A "My Wi-Fi is slow" screen: it reads each band's air, noise, temperature and devices plus the router's settings, lists problems to fix and recommendations, and sends each fix to the pending-changes bar so it goes through the usual preview, keys and undo. (c03a9a27723c6f797b7b684762242789521d2afb)
- Staying signed in: a sign-in lasts 90 days from the last use and survives a restart or an update of the app. Sign-ins are saved as a hash of each session cookie, never the cookie itself. (9e9894956b58c3bc69dc41e38f5fb46cf1ba0b18)
- Five feature folders with real controls for Guest Network Pro, Wi-Fi 7 multi-link, per-band radio extras, OpenVPN client details and IPv6, plus PPP keep-alive: the controls on the RT-BE88U model now cover 696 of its 5,493 settings, up from 404. (7b8b49ba00a873f792941be417d92b3b59976b11)
- A pretend router that models one real router (an RT-BE88U on Asuswrt-Merlin 3006, with its real setting names), and a control that is switched off, with the reason, whenever the router does not have its setting. (0e88388de9c6948fbd99287ba5e52f864e750fc5)
- One-click modes: seven ready-made modes (Gaming, Bedtime, Guest party, Work from home, Privacy DNS, Lock it down, Away) as real bundles of changes with exact old and new values, one-tap apply and undo, and a live "is it on" check. (f451a6fa35d7a63f3de301e36be206fb436a2614)
- The mode builder: compose your own mode from any catalogue setting with its real control. (8ea985db77a81e9508deea1baccd33347bc83253)
- A Top talkers screen that ranks who is uploading or downloading the most. (7053b5e1c7f61f1999ae653e564bbaa18b3cbd1b)
- Feature folders with rich controls and a check that every control really works. (9358d7f2d562b2f9761df8835355f719e4546668)
- Safety and records features: two-key super confirmation, element locks, the unlock ladder, support tickets, a built-in authenticator, QR pairing, local version history, exports, bulk actions, a changelog viewer, an offline documentation browser, update progress, front-screen provenance and a setup guide. These are on the safety-records branch and have no commit on the default branch yet.

### Changed

- Live mode applies every change by itself after a short pause, with nothing to review; a change that needs the four keys waits until you leave the field, then asks for them once. (9e9894956b58c3bc69dc41e38f5fb46cf1ba0b18)
- The four keys are asked only above the level the household chose or above what it allows right now. With the default choice of Level 1, a Level 1 change no longer asks for them. An owner override and a reboot still do. (9e9894956b58c3bc69dc41e38f5fb46cf1ba0b18)
- The speed test, DNS benchmark, port checker, device traffic, channel analyser, Wi-Fi QR, Wake-on-LAN and uptime example keep their own preferences in the app and no longer create settings on the router. (7cf23e89c229ab501b27c7aebc5fc9a651cbf8fe)
- NAT-PMP, 802.11k roaming, the guest device limit, the lights switch and the firmware check follow the names and values the 3006 firmware uses. (d4855154b25a97c638a35d76099d72823fbf936a)
- Ports screen: live port jacks with link, speed and duplex read from the switch chip, the chip named, port roles, hardware acceleration, jumbo frame size and IPTV multicast settings. Hardware screen: live processor, radio and fan dials, light schedule, RGB colour for gaming models and the button settings. A "who uses the most" tab on Device traffic ranks top downloaders and uploaders. Settings whose names may not exist on every firmware are offered only when the router lists them.

### Fixed

- The page no longer scrolls past the end of the app, which slid the side navigation away and left an empty band below it. (7a023210cf630eb904aa9d32aa03917b079c1f51)
- With nobody set up in the household, the four-key confirmation asks to acknowledge every device at home instead of naming the placeholder member. (20113e7c0794a7094ec9630004ed5636808716d6)
- The Postman collection lists every action again. (c03a9a27723c6f797b7b684762242789521d2afb)
- The pending-changes bar follows the Live and Review switch at once instead of at the next edit. (9e9894956b58c3bc69dc41e38f5fb46cf1ba0b18)
- The documentation site deployment and the publication language check. (4947429ea58beaf880fd7251a292cfadce109fd7)

## [0.1.0] - 2026-11-25

### Added

- The documentation website with 99 articles, a wiki and a phone-sized PDF edition. (38d94c077237c203e77bf7c9f13f38e3a330cb4d)
- The router manager core, the design canvas and the delivery files. (15322d98b360a2066aa3af3ce80b9e9a3d9c5369)
- The repository itself. (62de8742db4097a91da3e4aa64c4300bef900b65)
