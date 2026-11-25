// A built-in extension written exactly like a third-party one: it only talks
// JSON lines over standard input and output. It asks the app for the uptime.
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin });
let granted = [];
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.hello) {
    granted = msg.hello.permissions;
    process.stdout.write(`${JSON.stringify({ id: 1, call: "router.uptime" })}\n`);
  } else if (msg.id === 1) {
    const seconds = msg.ok ? msg.value.seconds : null;
    process.stdout.write(`${JSON.stringify({ result: { granted, seconds, days: seconds === null ? null : Math.floor(seconds / 86400), note: msg.ok ? "ok" : msg.error } })}\n`);
  }
});
