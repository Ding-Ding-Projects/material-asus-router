---
title: Visual editors for list settings
category: workflows
order: 3
summary: How the app edits settings that are really lists, such as device names, address reservations and port forwards, without you typing a raw string.
status: in-progress
related: router/address-reservations, router/port-forwarding, router/devices, safety/safe-changes
---

Some router settings are not single values but **lists**. The router stores a list of address reservations, a list of port forwards, a list of blocked devices, each as one long string packed with separators. Editing that string by hand is how people lock themselves out. The app gives these lists proper editors.

## The lists the app edits

| List | What a row holds |
| --- | --- |
| Device names | A hardware address and the friendly name you gave it |
| Address reservations | A hardware address, the fixed address and the name |
| Internet blocks | The devices that may not use the internet |
| Port forwarding | A name, external port, internal address and port, protocol |

## How an edit works

1. You add, change or remove a row. The editor checks it straight away: addresses must be valid and on your network, ports must be in range, text must be free of characters that break the stored string.
2. The app edits a **working copy** of the whole list. Several edits in a row combine correctly.
3. The change engine compares the working copy with the live list and builds the preview: rows added, removed and changed, written in plain words.
4. After you confirm, the list is stored in the router's own format. The app never asks you to type that format.

## What the editors prevent

| Mistake | What happens |
| --- | --- |
| Reservation address outside your network | Refused with a message |
| Two rows for the same device | Refused |
| A forward to an address that is not a device | Warned in the preview |
| Name with characters that break the list | Refused with the characters named |
| Port number out of range | Refused |

## Passwords and secrets

Rows hold no passwords. Anything secret is masked in previews and kept out of the change history.

## Status

| Part | State |
| --- | --- |
| Editing rules for the four lists | Built on the server and checked against the pretend router |
| Editor screens | In progress |
