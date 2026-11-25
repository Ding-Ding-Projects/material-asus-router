---
title: USB apps: sharing, media and backups
category: connect
order: 6
summary: Plug a drive into the router and share files, stream media and back up a Mac, with the speed limits and safety rules that matter.
status: in-progress
related: router/usb-storage, merlin/entware, security/hardening-checklist
---

A USB drive in the router becomes a small home server. The router's processor is modest, so this suits light jobs: a family photo share, a media library for the TV, a backup target. It is not a replacement for a proper network storage box.

The app already has switches for Windows file sharing, FTP, the media server and Time Machine backups (see [USB and storage](../router/usb-storage.md)). Drive listing and safe eject are in progress.

## What each service is for

| Service | Use | Notes |
| --- | --- | --- |
| Windows file sharing (Samba) | Open the drive as a network folder on Windows, Mac and Linux | Needs accounts with passwords. Do not leave guest access on |
| FTP | Transfer files to and from the drive | Plain FTP is unencrypted. Use it only on your home network |
| Media server | Let TVs and players browse photos, music and video | Streams well, but cannot convert formats |
| Time Machine | A Mac backs up to the drive | Give it a drive of its own, larger than the Mac's storage |
| Download tools | Run torrents or downloads on the router | Heavy on a small processor. Consider a separate device |

## Pick the drive

| File system | Works with | Notes |
| --- | --- | --- |
| ext4 | Router and Linux | Best behaved on the router. Windows cannot read it directly |
| NTFS | Router and Windows | Works. Slower on small routers |
| exFAT and FAT32 | Everything | FAT32 cannot hold files over 4 GB |

A powered drive is safer than a bus-powered one, which can overload the router's port.

## Share safely

1. Create **accounts** for the shares instead of enabling guest access. Give each person only the folders they need.
2. Keep the share on the **home network only**. Do not forward FTP or file-sharing ports to the internet. If you want access away from home, use a [VPN](../router/vpn.md).
3. Turn off services you do not use.

## Eject properly

Pulling a drive while it is writing corrupts it. Use the safe eject action, wait for the confirmation, then unplug.

## Speed expectations

Real-world speed is usually well below the drive's rating because of the router's processor and the USB port. A fast USB 3 port helps. If you need more, choose a dedicated storage device.

## Status

| Part | State |
| --- | --- |
| Service switches | Built |
| Drive list and safe eject | In progress |
| Accounts and share editor | Planned |
