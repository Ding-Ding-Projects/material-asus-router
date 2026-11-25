---
title: Troubleshooting connection errors
category: setup
order: 10
summary: Every message the app and host.bat show when something fails to start or connect, with the cause and the fix.
status: ready
related: setup/connect-router, setup/install, setup/remote-docker, reference/faq
---

Look for the exact message you see. Messages marked *host.bat* come from the start-up script; the rest come from the app.

## Starting the app (host.bat)

| Message | Cause | Fix |
| --- | --- | --- |
| the docker command is not installed on this computer | Docker is not installed or not on the path | Install Docker Desktop and run the script again. |
| Docker Compose is not available | Old Docker without the Compose plugin | Update Docker Desktop or install the Compose plugin. |
| Docker is installed but not running | The Docker service is stopped | Start Docker Desktop and wait until it says it is running. |
| Docker on user@host cannot be reached over SSH | SSH to the Docker host needs a password or fails | Make `ssh user@host docker info` work without a prompt. See [Remote Docker host](remote-docker.md). |
| the remote target must look like user@host | Bad `--remote` value | Use the form `pat@198.51.100.5`. |
| the image could not be pulled | No Internet, no access to `ghcr.io`, or the tag does not exist | Check the network and the `--tag` value. |
| --skip-pull was given, but the image is not on the host | Nothing to start without pulling | Remove `--skip-pull` or load the image first. |
| the app did not start. If the port is taken | Another program uses the port | Run again with `--port 8791` or another free port. |
| the app started but did not report healthy within 90 seconds | The container is crashing | Run `host.bat --logs` and read the last lines. |
| the app is healthy inside Docker, but the address does not answer from this computer | A firewall blocks the published port | Allow the port on the host firewall. |
| Unknown option | A mistyped option | Check the spelling against [Install](install.md). |

## Connecting to the router

| Message | Cause | Fix |
| --- | --- | --- |
| Connect a router first. | No router has been connected | Open the setup screen and [connect it](connect-router.md). |
| Enter the router's SSH user name. | The user name is empty or contains unusual characters | Type the router's SSH account name. |
| The SSH port must be from 1 to 65535. | A bad port number | Use 22 or the port you set on the router. |
| Enter the router's SSH password. | Password method with no password | Type it, or switch to the key method. |
| Generate this app's SSH key first, then allow it on the router. | Key method chosen but no key exists | Select **Generate key**, then add the public key on the router. |
| The router refused the user name, password or key. | Wrong account, wrong password, or the key is not allowed | Check the user name, re-enter the password, or add the public key to the router's authorized keys. |
| Could not reach the router: ... | Wrong address, SSH off, router off, or a network block | Check `198.51.100.1` (your address) is right, SSH is on for LAN, and the Docker host can reach the router. |
| Could not reach the router: the connection closed. | The router closed the connection early | Try again. Check that SSH is enabled and not limited by a firewall rule. |
| The router took too long to answer. | A slow or busy router | Wait and retry. A very busy router may need a restart. |
| Approve the router's host key to continue. | First connection | Compare the fingerprint and approve it once. |
| Connect to the router first. | The approval window of 5 minutes passed | Select **Connect** again, then approve. |
| That does not match the key the router showed. | The fingerprint you approved is not the pending one | Connect again and approve the one shown now. |
| The router presented a different host key than the one you approved. | The router's key changed, or something else answers at that address | See below. |
| The router key is missing. Generate one again. | The vault no longer holds the private key | Generate a new key and allow it on the router. |
| The router is using this key now. Replacing it needs confirmation. | You asked to generate a key while one is in use | Confirm only if you can allow the new key on the router. |

### The host key changed

This is a safety stop. Common harmless causes: you reset the router, reflashed its firmware or restored settings. Less common: another device took the router's address. Check who answers at that address first. If you are sure the change is yours, choose **Forget router** as the owner and connect again to approve the new key.

## Signing in and permissions

| Message | Cause | Fix |
| --- | --- | --- |
| That user name or password is not right. | Wrong details | Re-enter them. User names ignore case. |
| Too many failed sign-ins. Wait 15 minutes and try again. | Rate limit from that address | Wait, then sign in correctly. |
| This router manager already has an owner. Sign in instead. | Setup was already done | Sign in. |
| Passwords need 12 to 256 characters. | Password length | Use a longer password. |
| User names are 2 to 40 letters, digits, dots, dashes or underscores. | Invalid user name | Remove spaces and other symbols. |
| That user name is already used. | Duplicate | Choose another user name. |
| Your account can view the router but not change it. | Viewer role | Ask the owner for the operator role. |
| Only the owner can do this. | Owner-only action | Ask the owner. |
| The page is out of date. Reload and try again. | The page lost its session token | Reload the page and sign in again if asked. |

## Changing settings

| Message | Cause | Fix |
| --- | --- | --- |
| That preview expired. Preview the changes again. | Too much time passed | Preview again. |
| Another change is being applied. Wait for it to finish. | Two changes at once | Wait a moment. |
| ... changed on the router since the preview. Preview again. | Someone else changed it | Preview again to see the new old value. |
| The router would not start its safety timer, so nothing was changed. | The router could not arm the timed revert | Nothing was applied. Retry. If it repeats, the router may not allow the command. |

See [Connection-loss guard](../safety/connection-guard.md) for how the timer works.

## Still stuck

Run `host.bat --logs` and read the last lines. Never post logs, backups or screenshots that contain passwords or fingerprints you do not want public. Search the [FAQ](../reference/faq.md), then open an issue in the repository.
