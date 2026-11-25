# Running on the router itself

Material Asus Router can also run on the router, as an add-on for Asuswrt-Merlin on the
ASUS RT-BE88U. The router's firmware is not changed: the add-on installs next to it.

## Why an add-on and not a custom firmware

A research pass compared a custom firmware image with an add-on and chose the add-on:

- **Risk:** the firmware is untouched, so a problem in the add-on cannot stop the router from
  starting. Removing the add-on is one command.
- **Upkeep:** no firmware build tree, and no rebuilding for every Merlin release. The add-on
  lives on the router's JFFS storage and a USB drive, which survive firmware upgrades.
- **Space:** the RT-BE88U has 256 MB of flash holding two firmware copies. Node.js and the app
  live on a USB drive under Entware instead of inside the firmware.
- **Licence:** the add-on ships only this project's own code.

The fork named in `source.json` is kept for reference only and is not used by the add-on.

## How it behaves

- Installed from a normal release: `material-asus-router-addon.tar.gz` holds `install.sh`,
  `uninstall.sh`, `mar.sh`, the router web page and the app with its packages. Nothing is flashed.
- Needs JFFS custom scripts turned on, a USB drive with Entware, and Entware's Node.js.
- Off by default. A **Material Router** page under the router's Tools menu has the on/off switch
  and the port; every feature lives in the app itself, not in the router's stock pages.
- Two choices on that page: the Material version (the full modern app) and the Advanced version
  (it opens the action catalogue with every control and the terminal). The choice is remembered by
  each browser.
- Listens only on the router's home network address, on its own port, and needs its own sign-in.
- Switching it on or off restarts only the app. The router, Wi-Fi and internet are not touched.
- Updates go into a spare slot and switch over only after the new version answers its health
  check. A version that does not answer is removed and the old one starts again. Because the spare
  slot held the version before, a failed update also means there is no older version left to roll
  back to, and the add-on says so. Updates never restart the router.
- Known limit: the router's own web page still allows only one administrator signed in at a
  time. This app allows any number of people signed in at once.

## Installing

1. Turn on **Enable JFFS custom scripts and configs** (Administration, System) and let the router
   reboot.
2. Plug in a USB drive and install Entware with `amtm`, then `opkg update && opkg install node`.
3. Copy `material-asus-router-addon.tar.gz` to the router, check it against `SHA256SUMS.txt` from
   the same release, then:

   ```sh
   mkdir -p /tmp/mar && tar -xzf material-asus-router-addon.tar.gz -C /tmp/mar && sh /tmp/mar/install.sh
   ```

4. Open Tools, Material Router, switch it on and press Apply.

Other commands: `sh /jffs/addons/material-asus-router/mar.sh status|update|rollback`, and
`sh /jffs/addons/material-asus-router/uninstall.sh` (add `--purge` to delete the app's data too).

Status: the package is built and attached to every release, and its install, update, automatic
rollback and uninstall are tested end to end on Linux. It has not been installed on a real router
yet.
