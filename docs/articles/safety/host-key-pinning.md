---
title: Host key approval and pinning
category: safety
order: 8
summary: The router's SSH host key is approved once and pinned, so a different device cannot pose as your router.
status: in-progress
related: safety/encrypted-vault, setup/connect-router, wiki:glossary
---

When the app connects to a router over SSH, the router presents a host key, a fingerprint that identifies that particular device. Host key pinning means you approve that fingerprint once, the app remembers it, and the app refuses to continue if it ever sees a different one.

> [!NOTE]
> The fingerprint check is implemented in the SSH client. The approval screen and the "key changed" screen are **In progress**.

## First connection

1. During setup the app connects and receives the router's host key.
2. It shows the fingerprint, in the form `SHA256:` followed by a short string, and says "Approve the router's host key to continue."
3. You compare it with the fingerprint on the router if you can see it there, or accept it if you are on a trusted network.
4. Once you approve, the fingerprint is stored with the connection.

> [!EXAMPLE]
> Example of how a fingerprint looks, not your router's: `SHA256:Qm9ndXNFeGFtcGxlRmluZ2VycHJpbnRPbmx5` .

## Later connections

Every connection compares the presented fingerprint with the pinned one. If they match, nothing is shown. If they do not, the app stops before it sends any credential and shows "The router presented a different host key than the one you approved."

## When the key changes

| Likely cause | What to do |
| --- | --- |
| You reset the router to factory settings or changed the SSH key on purpose | Check that this is the router you expect, then approve the new key. |
| You replaced the router with another one at the same address | Approve the new key after confirming the hardware. |
| Someone is intercepting the connection | Do not approve. Check the network and the address. |

Only the owner can approve a new key. Approving replaces the pin and is recorded in the [change history](change-history.md).

## Why this matters

Without a pinned key, an attacker on the network could answer the connection and receive your credential. Pinning removes that opportunity after the first connection, which is why the first approval deserves a moment of attention.

## Limits

- Trust on first use means the very first approval is only as safe as the network you are on. Compare the fingerprint when you can.
- Pinning covers the SSH connection only. Other traffic, such as a browser opening the router's own web page, has its own certificate rules.

## Related

The credential that follows a successful check is stored in the [encrypted vault](encrypted-vault.md).
