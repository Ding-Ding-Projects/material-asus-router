---
title: SSH keys
category: merlin
order: 4
summary: How the app logs in to the router with a key instead of a password, how to install and remove keys, and how to keep them safe.
status: in-progress
related: setup/connect-router, safety/host-key-pinning, safety/encrypted-vault, router/system
---

The app talks to your router over SSH, the secure remote login. SSH can use a password or a **key pair**. A key pair is a private key that stays with the app and a public key that you give the router. The router lets in whoever holds the matching private key. Keys cannot be guessed the way passwords can.

## What the app does today

| Step | State |
| --- | --- |
| Generate an Ed25519 key pair in the app | Built |
| Store the private key in the [encrypted vault](../safety/encrypted-vault.md) | Built |
| Build a change that adds the public key to the router's allowed list | Built |
| Preview and apply it through the normal safe-change path | Built |
| Remove a key from the router | In progress |

## Set up a key

1. In **Setup**, ask the app to generate its key. It shows only the public half.
2. Choose **Install key on the router**. The app reads the router's current allowed keys, adds the new one and shows the old and new list in the preview.
3. Confirm. The app does not need your router password again afterwards.
4. Switch the connection to use the key and confirm that it works before you remove the password.

## Pin the router too

SSH works in both directions. The router shows a **host key** that proves which device it is, and the app asks you to approve it once, then pins it. If it changes, the app stops and tells you. See [Host key pinning](../safety/host-key-pinning.md).

## Keep keys safe

- The private key never leaves the app's vault and is never in the change history or logs.
- Give each person or computer its own key, so one can be removed.
- Lose a computer? Remove its key from the router at once.
- A key with no passphrase is only as safe as the place it is stored. The vault is encrypted.

## Turn off password SSH

Once keys work, you can turn off password logins on the router, which stops guessing attacks. If your model offers it, test with a key first, because a wrong order locks you out.

> [!WARNING]
> Never switch off SSH or password login from the same connection you are using without a second way in. The [guard](../safety/connection-guard.md) restores settings only if the app can still reach the router.

## Status

Install is built. Removal and the multi-key list are in progress.
