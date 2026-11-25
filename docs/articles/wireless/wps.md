---
title: WPS push-button setup
category: wireless
order: 9
summary: What WPS is for, why the PIN method is unsafe, and the short checklist for turning it off.
status: in-progress
related: security/hardening-checklist, wireless/mac-filter, router/wifi
---

Wi-Fi Protected Setup (WPS) lets a device join without typing the password. There are two methods: press a button on the router and the device within two minutes, or enter an eight-digit PIN.

> [!NOTE]
> **In progress.** The app has no WPS switch yet. The recommendation below is the advice the app will give.

## The risk

The PIN method checks the eight digits in two halves, so an attacker needs far fewer guesses than the number suggests. Tools exist that guess it over the air. A router with the PIN method on can have its Wi-Fi password revealed to someone who never saw it. Many modern routers rate-limit or remove the PIN method, but you should not depend on that.

| Method | Risk | Advice |
| --- | --- | --- |
| PIN | Guessable | Off |
| Push button | Anyone standing at the router can join for two minutes | Fine if no stranger can reach the router. Off if you never use it |

## When WPS is useful

A printer or speaker with no keyboard and no phone app. Even then, a printer's own screen or its app is usually easier than WPS.

## Steps (planned)

1. Open **Wi-Fi** and find **WPS**.
2. Switch it off and read the preview. Only the radio's WPS service restarts.
3. Confirm. If a device later cannot join, join it the ordinary way: choose the network and type the password.

> [!TIP]
> Turning WPS off does not change your Wi-Fi password and does not disconnect anyone.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| WPS switch in the app | In progress |
| Advice | Switch it off unless you have a specific use |
