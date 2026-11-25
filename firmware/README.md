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

## Planned behaviour

- Installed from a normal release: an archive, `install.sh`, `uninstall.sh` and checksums.
  Nothing is flashed.
- Needs JFFS custom scripts turned on, a USB drive with Entware, and Entware's Node.js.
- Off by default. One switch on a page added to the router's own web interface turns it on;
  every feature lives in the app itself, not in the router's stock pages.
- Two choices on that page: the Material version (the full modern app) and the Advanced version
  (every control, the action catalogue and the terminal). The choice is remembered per browser.
- Listens on the home network only, on its own port, and needs its own sign-in.
- Updates from this repository's releases into a spare slot and switches over only after a
  health check, so a bad update rolls back by itself. Updates never restart the router.
- Known limit: the router's own web page still allows only one administrator signed in at a
  time. This app allows any number of people signed in at once.

Status: in progress. No add-on release has been published yet.
