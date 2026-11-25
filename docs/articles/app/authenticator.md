---
title: Authenticator (two-step sign-in)
category: app
order: 21
summary: Planned: add a time-based code to the app's own sign-in.
status: in-progress
related: safety/roles-and-access, safety/encrypted-vault
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Authenticator (two-step sign-in) is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Ask for a six-digit code from an authenticator app in addition to the password when someone signs in to Material Asus Router.

## Planned behaviour

- Each person can turn it on and scan a setup code.
- Recovery codes are shown once at setup.
- The owner can require it for everyone.
- The secret behind the codes is stored in the encrypted vault.

## What is missing

Two-step sign-in is not built. This protects app accounts only, not the router's own login.

## Good to know

- Keep your recovery codes somewhere safe.
- A lost authenticator without recovery codes needs the owner to reset it.

## A planned walkthrough (demonstration)

Turning on a second sign-in step:

1. Open **Account** and choose **Add an authenticator**.
2. The app shows a code to scan with an authenticator app on your phone, and a set of one-time recovery codes. Save the recovery codes somewhere safe.
3. Enter the six-digit code your phone shows to prove it works.
4. From then on, signing in needs your password and a fresh six-digit code.

## Questions people ask

**What if I lose my phone?** Use a recovery code. Each works once. The owner can also reset another person's authenticator.

**Is the secret stored safely?** It is kept in the encrypted vault. See [Encrypted vault](../safety/encrypted-vault.md). The recovery codes are shown once and then stored only as hashes.

**Does it protect the router?** It protects sign-in to the app, which is what holds the keys to the router.
