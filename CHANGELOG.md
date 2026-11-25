# Changelog

Every release of Material Asus Router, newest first. Each change names the full commit that made it, so the app can check that the commit really exists on GitHub. Entries are factual and are updated in every task that changes the project.

## [Unreleased] - 2026-11-25

### Added

- Five feature folders with real controls for Guest Network Pro, Wi-Fi 7 multi-link, per-band radio extras, OpenVPN client details and IPv6, plus PPP keep-alive: the controls on the RT-BE88U model now cover 696 of its 5,493 settings, up from 404. (7b8b49ba00a873f792941be417d92b3b59976b11)
- A pretend router that models one real router (an RT-BE88U on Asuswrt-Merlin 3006, with its real setting names), and a control that is switched off, with the reason, whenever the router does not have its setting. (0e88388de9c6948fbd99287ba5e52f864e750fc5)
- Feature folders with rich controls and a check that every control really works. (9358d7f2d562b2f9761df8835355f719e4546668)
- Safety and records features: two-key super confirmation, element locks, the unlock ladder, support tickets, a built-in authenticator, QR pairing, local version history, exports, bulk actions, a changelog viewer, an offline documentation browser, update progress, front-screen provenance and a setup guide. These are on the safety-records branch and have no commit on the default branch yet.

### Changed

- The speed test, DNS benchmark, port checker, device traffic, channel analyser, Wi-Fi QR, Wake-on-LAN and uptime example keep their own preferences in the app and no longer create settings on the router. (7cf23e89c229ab501b27c7aebc5fc9a651cbf8fe)
- NAT-PMP, 802.11k roaming, the guest device limit, the lights switch and the firmware check follow the names and values the 3006 firmware uses. (d4855154b25a97c638a35d76099d72823fbf936a)

### Fixed

- The documentation site deployment and the publication language check. (4947429ea58beaf880fd7251a292cfadce109fd7)

## [0.1.0] - 2026-11-25

### Added

- The documentation website with 99 articles, a wiki and a phone-sized PDF edition. (38d94c077237c203e77bf7c9f13f38e3a330cb4d)
- The router manager core, the design canvas and the delivery files. (15322d98b360a2066aa3af3ce80b9e9a3d9c5369)
- The repository itself. (62de8742db4097a91da3e4aa64c4300bef900b65)
