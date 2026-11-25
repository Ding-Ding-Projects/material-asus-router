---
title: Port triggering
category: lan
order: 3
summary: Open a port only while a device is using another one, how it differs from port forwarding, and why it works for one device at a time.
status: in-progress
related: router/port-forwarding, lan/dmz, security/port-forward-safely, lan/upnp
---

Port forwarding keeps a door open all the time. **Port triggering** opens a door only after a device inside makes an outgoing connection on a chosen "trigger" port. The router then opens the "incoming" ports towards that device for a short time and closes them again.

> [!NOTE]
> **In progress.** Port forwarding rules are built (see [Port forwarding](../router/port-forwarding.md)). A port triggering editor is not.

## Compare

| | Port forwarding | Port triggering |
| --- | --- | --- |
| Door open | Always | Only after the trigger |
| Needs a fixed device address | Yes | No |
| Number of devices that can use a rule | One per port | One at a time per rule |
| Risk when idle | The port can be probed | Nothing is open |

## Worked example (demonstration)

An old game connects out to port 6000 and then expects the server to connect back on 7000 to 7010.

| Field | Value |
| --- | --- |
| Trigger port | 6000, TCP |
| Incoming ports | 7000 to 7010, TCP |

When any home device connects out to 6000, the router lets the server in on 7000 to 7010 towards that device, until the connection goes quiet.

## When it is the right tool

A device that does not use a fixed port, or several household members who take turns playing the same game. If a device needs the same port every time, ordinary [forwarding](../router/port-forwarding.md) is simpler.

## Limits

- Only one device at a time can hold a trigger. A second device that triggers the same rule replaces the first.
- Applications that need an inbound connection *before* any outgoing one cannot use it.
- Rules need to be removed when the application is retired, as with any open port.

## Steps (planned)

1. Open the **Port forwarding** area and choose Triggering.
2. Enter the trigger port, the incoming range and the protocol.
3. Read the preview: it shows exactly which ports will open and when.
4. Test by running the application. Then check the router log.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Triggering editor | Planned |
