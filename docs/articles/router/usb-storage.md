---
title: USB and storage sharing
category: router
order: 17
summary: See attached USB drives and decide whether and how they are shared on your network.
status: in-progress
related: router/firewall, router/devices, router/maintenance, router/system
---

Many Asus routers have a USB port. A drive plugged into it can be shared over the home network as simple network storage, or used by a printer-sharing or download service. This guide covers what the app shows and the sharing choices that matter for safety.

> [!NOTE]
> **In progress.** Reading attached drives is built; the sharing screen and real-router tests are still being built. The app shows this area only on models with a USB port, and marks it unavailable on others.

## What you see

| Item | Meaning |
| --- | --- |
| Drive name and size | What the router reports for the attached disk |
| File system | For example NTFS, ext4 or FAT32 |
| Used and free space | How full it is |
| Health | The router's read of the drive state, where available |
| Shares | The folders that are shared and with whom |

## Share a drive

1. Plug the drive into the router and wait for it to appear in **USB and storage**.
2. Turn on the sharing service you need. File sharing over the local network is the usual one.
3. Choose which folders are shared and whether access needs a user name and password.
4. Create a user for each person and give each the least access they need: read only, or read and write.
5. Review the preview and confirm. The router restarts its sharing service for a moment; open file transfers stop.
6. Connect from a computer using the router's local address, for example `\\198.51.100.1`.

> [!WARNING]
> Never share a drive with guest access open to the internet. Keep sharing on the local network only, and leave [remote access](firewall.md) off unless you have secured it. Shared folders that are open to everyone on the local network are open to a compromised device too.

## Remove a drive safely

Use **Eject** in the app before unplugging. Pulling a drive without ejecting can damage the file system. The eject action saves nothing to history because it changes no setting, but it needs confirmation.

## Tips

- Use a drive with its own power if it is a large spinning disk; some routers cannot supply enough power.
- Format the drive in a file system your devices all understand.
- Keep a second copy of anything important. Router-attached storage is a convenience, not a backup. See [Backup and restore](backup-restore.md) for the router's own settings.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Basic drive sharing | Yes | Yes |
| Extra services such as add-on stores | Limited | Add-on support with a USB drive; see [Merlin extras](merlin-extras.md) |

## Status

| Part | State |
| --- | --- |
| Read attached drives | Built |
| Sharing screen and users | In progress |
| Eject | In progress |
