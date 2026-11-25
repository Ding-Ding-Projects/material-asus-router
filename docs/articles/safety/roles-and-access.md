---
title: Roles and access control
category: safety
order: 6
summary: How owner, operator and viewer roles are enforced on the server, not only hidden in the interface.
status: in-progress
related: app/accounts-and-roles, safety/safe-changes, safety/encrypted-vault
---

This page explains the safety side of accounts: what each role is allowed to do and how that is enforced. For how to add and manage people, see [accounts and roles](../app/accounts-and-roles.md).

> [!NOTE]
> Role checks on the server are implemented and have automated tests in the repository. The management screens are **In progress**.

## The three roles

| Role | Can read the router | Can change settings | Can manage people and the router connection |
| --- | --- | --- | --- |
| Owner | Yes | Yes | Yes |
| Operator | Yes | Yes | No |
| Viewer | Yes | No | No |

The owner is the first person to create an account. There is one owner. The owner can add up to 50 operators and viewers.

## Enforced on the server

Hiding a button is not security. Every request goes through a check that looks at the signed-in person's role and the request type:

- Viewers may read, and may open a **preview** so they can see what a change would do, but a request that applies, undoes or reboots is refused with the sentence "Your account can view the router but not change it."
- Operators may change settings. Actions reserved for the owner, such as adding people, changing the router connection or approving a new SSH key, are refused with "Only the owner can do this."
- Everyone can sign out.

Because the refusal happens on the server, it applies equally to the normal screens and to anything that calls the app's interface directly.

## Sessions and passwords

- Passwords for the app's own accounts are stored as salted hashes, never as text.
- A session ends when the person signs out or the session expires.
- Router credentials are separate from app accounts. They belong to the connection, are set by the owner, and live in the [encrypted vault](encrypted-vault.md).

## Good practice

- Use the owner account only for setup and people management. Do daily work as an operator.
- Give guests and family members who only need to look the viewer role.
- Remove people who no longer need access. Their history entries remain, with their name.
- Do not share one account between people; the [change history](change-history.md) shows who confirmed each change.

## Tips

If someone cannot find a button, check their role first. The refusal messages are written to say what is missing rather than just "not allowed".
