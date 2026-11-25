---
title: Writing an extension
category: tools
order: 11
summary: How to write an extension in any language: the manifest, the JSON-lines protocol, the permissions and working samples.
status: ready
related: tools/network-tools, safety/encrypted-vault
---

An extension is a small separate program that adds a feature to Material Asus Router. The app starts it, talks to it over standard input and output, answers its questions about the router, and stops it. Because the conversation is plain JSON lines, you can write an extension in any language that can read and write text.

> [!NOTE]
> The extension manager is on the **Extensions** screen. Two extensions are built in: the uptime log and the scheduled restart planner. Installing an extension from a file is **In progress**: today only the built-in ones run. The manifest check, the permissions and the protocol below are real and are what the built-in ones use.

## The manifest

Every extension has a manifest, a JSON object with exactly these fields.

```json
{
  "schema": 1,
  "id": "uptime-log",
  "version": "1.0.0",
  "entry": "uptime-log.mjs",
  "name": { "en": "Uptime log", "yue": "運行時間記錄" },
  "description": { "en": "Reads how long the router has been running.", "yue": "讀取路由器已經運行咗幾耐。" },
  "permissions": ["router.status"],
  "author": "Pat"
}
```

The check refuses a manifest with a wrong `schema`, an `id` that is not lowercase letters, digits and dashes, a `version` that is not like `1.0.0`, an `entry` that has a folder in it, a missing English or Cantonese text, a repeated or unknown permission, or any field it does not know.

## The permissions

| Permission | What it lets the extension do |
| --- | --- |
| `router.status` | Read how long the router has been running. |
| `nvram.read` | Read ordinary router settings. Anything that looks like a password, key, token or secret is never given, even with this permission. |

SSH credentials, router passwords and write access have no permission at all. A manifest that asks for `ssh.credentials`, `router.password`, `vault.read`, `nvram.secrets`, `nvram.write` or `router.exec` is refused outright.

The person must allow every permission an extension asks for before it runs. The app remembers what you allowed together with the version of the permissions you saw, so if an update asks for more, it asks you again.

## The protocol

The app starts your program and sends one line to its standard input.

```json
{"hello":{"api":1,"permissions":["router.status"]}}
```

Your program may then send requests, one JSON object per line, each with a number `id`.

```json
{"id":1,"call":"router.uptime"}
{"id":2,"call":"nvram.get","key":"productid"}
```

The app answers each with the same `id`.

```json
{"id":1,"ok":true,"value":{"seconds":86400}}
{"id":2,"ok":false,"error":"permission-denied"}
```

When you are done, send one result line and exit. The result can be any JSON.

```json
{"result":{"days":1}}
```

## The limits

An extension runs for at most 5 seconds, writes at most 64 KiB, and may make at most 20 requests. It gets an empty environment, so it cannot see any of the app's variables. If it passes a limit, sends something that is not JSON, or exits without a result, the app stops it and shows the reason.

## A sample in JavaScript

```js
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.hello) process.stdout.write(JSON.stringify({ id: 1, call: "router.uptime" }) + "\n");
  else if (msg.id === 1) process.stdout.write(JSON.stringify({ result: { days: Math.floor(msg.value.seconds / 86400) } }) + "\n");
});
```

## A sample in Python

```python
import json, sys

for line in sys.stdin:
    msg = json.loads(line)
    if "hello" in msg:
        print(json.dumps({"id": 1, "call": "router.uptime"}), flush=True)
    elif msg.get("id") == 1:
        print(json.dumps({"result": {"days": msg["value"]["seconds"] // 86400}}), flush=True)
        break
```

## Good to know

An extension is read only today: nothing it can ask for changes the router. When a write permission is added, it will go through the same preview, safety net and undo as every other change.
