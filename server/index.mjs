// Starts the web app. Settings come from the environment or flags:
//   PORT (8790), BIND_ADDRESS (0.0.0.0), DATA_DIR (./data), --demo or DEMO=1,
//   DEMO_PROFILE=rt-be88u-merlin-3006 makes the demo router a model of one real router
import { createApp } from "./app.mjs";

const demo = process.argv.includes("--demo") || process.env.DEMO === "1";
const port = Number(process.env.PORT ?? 8790);
const host = process.env.BIND_ADDRESS ?? "0.0.0.0";

const app = await createApp({ demo, demoProfile: process.env.DEMO_PROFILE || null, dataDir: process.env.DATA_DIR ?? "./data", log: true });
await app.listen(port, host);
console.log(`Material Asus Router is running on http://${host === "0.0.0.0" ? "localhost" : host}:${app.port}/`);
if (demo) console.log(`Demo mode: a pretend router is listening on 127.0.0.1:${app.demoRouter.port}. Create the owner account in the browser.`);

const stop = async () => {
  await app.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
