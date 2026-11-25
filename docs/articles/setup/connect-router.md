---
title: Connect your router
category: setup
order: 4
summary: Turn on SSH on the router, choose a key or a password, and approve the router's host key once.
status: ready
related: setup/firmware-detection, setup/troubleshooting, reference/security-model, setup/first-owner-account
---

The app manages your router over SSH. This guide covers turning SSH on, the two ways to sign in, and the one-time host key approval. Only the **owner** can connect, change or forget the router connection.

## 1. Turn on SSH on the router

In the router's own web page, open the administration area and find the SSH setting (on stock ASUS firmware it is under Administration, System, Service; on Asuswrt-Merlin it offers a choice of LAN only, WAN or both).

- Enable SSH for **LAN only**. Do not enable it on the WAN side.
- Note the **SSH port**. It is 22 unless you changed it.
- Note the **SSH user name**. On most Asus routers this is the same administrator name you use on the router's web page.

Allowing password login for SSH is only needed if you choose the password method below.

## 2. Choose how the app signs in

| Method | How it works | When to choose it |
| --- | --- | --- |
| **App-generated SSH key** (default) | The app makes an Ed25519 key pair. The private key is stored encrypted; you add the public key to the router. | Best choice. No router password is stored. |
| **Router password** | You type the SSH password once on the app's setup screen. It is stored encrypted. | Quick to start, but the password lives in the app's vault. |

The password is typed **only** on the app's setup screen. It never goes into `.env`, the setup script or a command line.

### Using the app-generated key

1. On the setup screen choose the key method and select **Generate key**. The app shows the public key.
2. Copy the public key into the router's list of authorized SSH keys (on the router's web page under the SSH settings, or paste it into the authorized keys box).
3. Return to the app and connect.

If the router is already connected with a password, the owner can instead choose **Allow this key on the router**. The app turns that into a normal previewed change to the router's authorized keys, so you see it before it is applied.

Generating a key while one is in use asks for confirmation, because replacing it would lock the app out until the new key is allowed.

## 3. Enter the connection details

| Field | Example | Notes |
| --- | --- | --- |
| Address | `198.51.100.1` | The router's LAN address. A host name also works. |
| SSH port | `22` | 1 to 65535. |
| SSH user name | `admin` | The router's SSH account. |

Select **Connect**. The app waits up to 10 seconds for the router.

## 4. Approve the host key once

The first time, the app does not trust the router yet. It shows the router's **host key fingerprint**, which looks like `SHA256:` followed by a long string.

> [!TIP]
> To check it, compare the fingerprint with the one the router shows or with what `ssh-keygen -l` reports for the router's host key. If you are on your own network and just set SSH up, approving it is normal.

Choose **Approve**. The app checks that the fingerprint you approved matches the one the router showed, connects once more to confirm it, and **pins** the key. The approval request expires after 5 minutes.

From then on the app refuses a router that presents a different key. If the key changes (for example after a firmware reset or if something else answers on that address) the app tells you and does not connect. See [Troubleshooting](troubleshooting.md).

## 5. What happens next

Once connected, the app reads the router's settings and works out the firmware flavour, see [Firmware detection](firmware-detection.md). The connection is kept alive for the app and re-used for each action.

To remove the connection, the owner can choose **Forget router**. That clears the saved connection and the stored password. The data volume and change history stay.

## Safety notes

- Keep the app on your own network. See [Data and security model](../reference/security-model.md).
- Credentials are stored with AES-256-GCM and are never returned by the API or written to the logs.
- Secrets inside router settings (such as Wi-Fi passwords) are masked until the owner chooses to reveal them.
