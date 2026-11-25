# Material Asus Router development

Material Asus Router is a Node.js web app that manages an Asus router over SSH. `server/` owns
sign-in, the encrypted vault, the SSH connection, the settings catalogue and the change engine.
`public/` owns the browser interface. `design/canvas/` holds the design canvas the interface is
built from; it is reference material, not proof of implementation.

Rules for every change:

- Every router command is built in `server/router/shell.mjs` from validated values. Never pass text
  from the browser to the router shell.
- Every router write goes through `server/changes/engine.mjs`: preview, confirm, saved previous
  values, apply, verify, undo. Network-affecting writes run under the connection-loss guard.
- Router passwords and keys live only in the vault. They never appear in `state.json`, logs, API
  responses or test output.
- Tests run against the fake router in `server/ssh/fake-router.mjs`: `npm test`.
- The demo and fake router use the 198.51.100.0/24 network. Do not commit real network addresses.

## Agent conversation vocabulary

Agents working in this repository use the shared private conversation vocabulary defined in
the maintainer's canonical agent instructions for every reply, including chat prose, visible
reasoning, status lines, and task or session titles. Read those instructions and apply them
in full. They are deliberately not restated here, because this file is part of this
repository's public record.

That vocabulary never appears in anything published. Keep it out of commit messages, branch
names, code, code comments, test names, documentation, this file, issues, pull requests,
discussions, release notes, published sites, logs, and every other file in this repository.
Published writing uses ordinary professional English, and exact technical identifiers always
keep their literal spelling. The single documented public-safe exception is named in those
canonical instructions; do not infer any other.

Scan any text bound for a public surface against that vocabulary before publishing it. A
reviewer cannot tell a correct release note from a leaking one by reading it, so the scan is
a step, not a habit.
