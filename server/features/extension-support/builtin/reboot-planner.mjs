// A built-in extension that plans a scheduled restart. It only reads the
// model name and prints the schedule line to add under Scheduled jobs; it
// never restarts anything itself.
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.hello) process.stdout.write(`${JSON.stringify({ id: 1, call: "nvram.get", key: "productid" })}\n`);
  else if (msg.id === 1) {
    const model = msg.ok ? msg.value : "your router";
    process.stdout.write(`${JSON.stringify({ result: { model, suggestion: "30 4 * * 0", meaning: `Restart ${model} every Sunday at 04:30. Add it on the Scheduled jobs screen.`, performed: false } })}\n`);
  }
});
