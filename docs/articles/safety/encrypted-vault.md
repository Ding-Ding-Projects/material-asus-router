---
title: The encrypted vault
category: safety
order: 7
summary: How router passwords and keys are stored encrypted with AES-256-GCM and where the key lives.
status: in-progress
related: safety/host-key-pinning, safety/roles-and-access, setup/connect-router
---

The app needs to sign in to your router over SSH, so it has to keep a credential: either an SSH key it generated, or the router password. The vault is the part that stores those values so they never sit in plain text on disk or in a log.

> [!NOTE]
> The vault is implemented in `server/vault.mjs`. How the pieces are laid out on your own data volume depends on your Docker setup, and the Windows desktop app's storage is **In progress**.

## What is stored

| Value | Where it comes from |
| --- | --- |
| The generated SSH private key (default sign-in method) | Created by the app during setup. You never copy it around. |
| The router password (alternative method) | Typed only in the app's setup screen. |
| Other secret values the app needs later | For example secrets of future features. |

The public half of the generated key is shown so you can install it on the router, as described in [connect your router](../setup/connect-router.md).

## How it protects them

- Each value is encrypted with **AES-256-GCM**, which both hides the value and detects tampering.
- A random 256-bit key is created the first time the app starts. It is kept in its own file on the data volume with owner-only permissions, separate from the file of encrypted values.
- Values are never returned by the app's interface. Screens show that a credential exists, not what it is.
- Values do not appear in logs, in the change history or in exports.

> [!IMPORTANT]
> The key file and the encrypted file together are enough to recover the secrets. Back up and protect the data volume as a whole, and do not store a backup of it somewhere other people can read.

## What the vault does not do

- It does not protect against someone who can read your whole data volume while the app is running with the key in memory.
- It does not encrypt the app's own sign-in passwords; those are salted hashes, not recoverable.
- It does not replace good router hygiene such as a strong router password and a restricted SSH setting.

## If you lose the key file

The encrypted values cannot be read. The app will report that the connection credential is damaged. Run setup again to generate a new key and install it on the router. Nothing on the router itself is lost.

## Rotating a credential

The owner can replace the stored router password or generate a new SSH key from the connection settings. The old value is overwritten. After rotating a key, remove the old public key from the router.

## Related

[Host key pinning](host-key-pinning.md) protects the other side of the connection: it makes sure the app talks to your router and not to something pretending to be it.
