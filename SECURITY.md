# Security

Material Asus Router holds the keys to your router, so its design keeps them narrow:

- The router password or the app-generated SSH key is stored encrypted (AES-256-GCM) on the data
  volume. The encryption key sits in its own file with owner-only permissions.
- The router's SSH host key is shown once for approval and pinned. A different key is refused, so a
  look-alike device cannot receive your password.
- Router commands are built on the server from validated values only.
- Every write is previewed, saved for undo, and network-affecting writes arm a timed revert on the
  router itself before they apply.
- Roles are enforced on the server: owner, operator (changes settings), viewer (read only).
- The app is meant for your home network. Do not expose it to the internet; use a VPN.

## Reporting a vulnerability

Please open a private security advisory on this repository
(Security tab, "Report a vulnerability"). Do not open a public issue for security problems.
