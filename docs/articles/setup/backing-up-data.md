---
title: Back up the data volume
category: setup
order: 9
summary: Copy and restore the volume that holds accounts, the encrypted vault and the change history.
status: ready
related: setup/updating, router/backup-restore, reference/security-model
---

Everything the app remembers is in one Docker volume mounted at `/data`. This guide backs up **the app's own data**. To back up the router's settings, see [Backup and restore](../router/backup-restore.md); the two are different things.

## What the volume holds

| File | Contents |
| --- | --- |
| `state.json` | Accounts (password hashes only), the saved router connection (without the password), settings, change history |
| `vault.json` | The router password and the app's SSH private key, each encrypted |
| `vault.key` | The random AES-256-GCM key for the vault, mode 0600 |
| `sessions.json` | Who is signed in: a hash of each session cookie, never the cookie itself. Without it everyone simply signs in again |

> [!WARNING]
> `vault.key` and `vault.json` together can unlock the stored router credentials. Treat a backup of the volume like a password: keep it somewhere private and encrypted. Keep it off shared drives.

## Find the volume name

Compose prefixes the volume with the project name, which is the folder name by default.

```
docker volume ls
```

Look for a name ending in `router-data`, for example `material-asus-router_router-data`. Use your own name below.

## Back it up

Stop the app first so no write is in progress, then copy the volume into a `.tar.gz` file in the current folder.

```
host.bat --stop
docker run --rm -v material-asus-router_router-data:/data:ro -v "$PWD":/backup alpine tar czf /backup/router-data-backup.tar.gz -C /data .
host.bat --detached
```

On Windows PowerShell replace `"$PWD"` with `"${PWD}"`. Example output of a successful run is a new file `router-data-backup.tar.gz` in your folder; the command itself prints nothing.

For a remote Docker host, run these on that host or set `DOCKER_HOST` to the SSH target first.

## Restore it

1. Stop the app: `host.bat --stop`.
2. Put the backup file in the current folder.
3. Restore into the volume. This **replaces** what is in it.

```
docker run --rm -v material-asus-router_router-data:/data -v "$PWD":/backup alpine sh -c "rm -rf /data/* /data/.[!.]* ; tar xzf /backup/router-data-backup.tar.gz -C /data"
```

4. Start the app again and sign in with an account that existed at the time of the backup.

The files must belong to the user the app runs as (`node`, user ID 1000). If the app reports a damaged or unreadable data file after a restore, run `chown -R 1000:1000 /data` inside the helper container.

## Start over with an empty volume

This deletes accounts, the vault and the history.

```
host.bat --stop
docker compose down -v
```

## How often

Back up after changing accounts or connecting a new router, and before each [update](updating.md). The history is small, so frequent backups are cheap.
