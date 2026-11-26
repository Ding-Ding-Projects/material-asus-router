// Commands to the router are short request-and-answer exchanges. With Nagle's algorithm left on,
// each exchange waited for the other side's delayed acknowledgement: about 175 ms a command on
// Linux, so a change of a dozen commands outlasted the test safety timer and was put back.
import assert from "node:assert/strict";
import { test } from "node:test";
import { RouterConnection } from "../server/ssh/client.mjs";
import { FakeRouter } from "../server/ssh/fake-router.mjs";

test("router commands answer at once instead of waiting on delayed acknowledgements", async () => {
  const router = await new FakeRouter({ firmware: "merlin" }).listen(0, "127.0.0.1");
  const c = new RouterConnection({ host: "127.0.0.1", port: router.port, username: router.username, password: router.password, hostKey: router.hostKeyFingerprint });
  await c.connect();
  try {
    await c.exec("nvram get productid");
    const started = Date.now();
    for (let i = 0; i < 30; i += 1) await c.exec("nvram get productid");
    const each = (Date.now() - started) / 30;
    assert.ok(each < 80, `a command took ${each.toFixed(0)} ms on average; with delayed acknowledgements it takes about 175 ms`);
  } finally {
    c.close();
    await router.close();
  }
});
