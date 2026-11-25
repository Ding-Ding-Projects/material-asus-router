---
title: Add people and roles
category: setup
order: 7
summary: Add operators who can change settings and viewers who can only look, and manage their accounts.
status: ready
related: setup/first-owner-account, app/accounts-and-roles, reference/security-model
---

The owner can give other people their own sign-in. Each person has exactly one role besides the owner.

| Role | Can | Cannot |
| --- | --- | --- |
| **Operator** | Read everything, preview, apply and undo changes, run network tools | Manage people, connect or forget the router, approve host keys, include secrets in a backup |
| **Viewer** | Read everything and preview changes | Apply, undo or change anything |

Roles are enforced on the server for every request, not just by hiding buttons. A viewer who sends a change request directly is refused with "Your account can view the router but not change it." An operator who tries an owner-only action is told "Only the owner can do this."

> [!NOTE]
> A viewer can still *preview* a change, because a preview changes nothing. This lets someone check what a change would do without being able to apply it.

## Add a person

1. Sign in as the owner and open the people screen.
2. Choose to add a person.
3. Enter a **user name** (2 to 40 letters, digits, dots, dashes or underscores), an optional **name**, a **role** and a **password** of 12 to 256 characters.
4. Save. Give the person their user name and password through a channel you trust.

User names are not case sensitive for uniqueness, so `Alex` and `alex` count as the same name. The owner's user name is included in that check. A router can have at most 50 people besides the owner.

## Change a role or reset a password

Choose the person, then change the role, the name or set a new password. Changing a role or a password signs that person out everywhere, so the change takes effect immediately.

## Remove a person

Choose **Remove** next to their name. Their sessions end immediately. Changes they made stay in the [change history](../safety/change-history.md) with their name beside them.

## Suggested setup for a household

- Pat is the owner and keeps the password in a password manager.
- Alex, who sometimes changes the Wi-Fi password, is an operator.
- Everyone else who only wants to check what is connected is a viewer.

## What roles do not do

Roles control the app, not the router. Anyone who has the router's own administrator password can still sign in to the router directly. Keep that password separate and private.

Read more in [Accounts and roles](../app/accounts-and-roles.md) and [Data and security model](../reference/security-model.md).
