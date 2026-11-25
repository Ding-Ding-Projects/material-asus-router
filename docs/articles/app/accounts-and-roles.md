---
title: Accounts and roles
category: app
order: 1
summary: The first account becomes the owner, who then adds operators and viewers.
status: in-progress
related: safety/roles-and-access, setup/connect-router, app/authenticator
---

Material Asus Router has its own accounts, separate from the router's login. They decide who can look at the router and who can change it.

> [!NOTE]
> The account rules are implemented on the server and have automated tests in the repository. The sign-in, setup and people screens are **In progress**.

## The first account is the owner

On a fresh installation nobody has an account yet. The first person to register becomes the **owner**. There is no setup code to type. One check at the server means only one owner can ever be created: any later attempt is refused with a message pointing to sign-in.

> [!IMPORTANT]
> Register the owner account straight after you start the app, before anyone else on the network can reach it. Start it on a network you trust, and do not expose it to the internet.

## The three roles

| Role | What the person can do |
| --- | --- |
| Owner | Everything. Manages people, the router connection and the host key, and can change settings. |
| Operator | Views the router and changes settings, with the usual preview and confirmation. |
| Viewer | Views the router and previews changes, but cannot apply them. |

See [roles and access control](../safety/roles-and-access.md) for how this is enforced.

## Add a person

1. Sign in as the owner and open **People**.
2. Choose **Add person**.
3. Enter a name, a username and a starting password, and choose **Operator** or **Viewer**.
4. Give the person their details through a channel you trust, and ask them to change the password.

An installation can have up to 50 people besides the owner. Usernames must be unique and are not case sensitive.

## Change a role or remove a person

Open the person in **People**. You can change their role, rename them or reset their password. Removing a person ends their access immediately. Their entries in the [change history](../safety/change-history.md) stay, with their name.

## Signing in and out

Enter your username and password. The app takes the same time to answer whether the username exists or not, so it does not reveal which usernames are real. Sign out when you leave a shared computer.

## Two-step sign-in

A time-based second step is planned. See [Authenticator](authenticator.md).

## Things to know

- Router credentials are not app accounts. They are stored once for the connection, in the [encrypted vault](../safety/encrypted-vault.md).
- If the owner forgets their password, it cannot be reset from inside the app. How to recover is part of the planned operations guide.
- Use names such as Pat and Alex in your own notes to remember who is who, not shared accounts.
