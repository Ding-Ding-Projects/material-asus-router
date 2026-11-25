// Change safety: live mode, the household impact levels, four-key confirmation,
// the configuration history, undo and redo, quiet apply, the reboot launch
// sequence and live progress. The behaviour itself lives in server/changes/
// (it needs the change engine); this folder adds the screen's data and the
// pretend router's reboot, so a test can watch a router go down and come back.
//
// The HTTP API is /api/safety/* and /api/changes/live, documented in
// docs/articles/change-safety.md.
import { L } from "../kit.mjs";

export default {
  id: "change-safety",

  domainMeta: [{ id: "change-safety", icon: "shield_lock", label: L("Change safety", "改動安全"), group: { en: "Safety", yue: "安全" } }],
  domains: {
    "change-safety": async (ctx) => {
      const settings = ctx.session.store.read().settings;
      return { liveMode: settings.liveMode !== false, guardSeconds: settings.guardSeconds ?? null };
    },
  },

  fakeRouter: {
    handlers: [
      // `router.rebootMs = 1500` makes the pretend router go away for that long
      // after a reboot, with a fresh uptime when it answers again.
      (command, router) => {
        if (command !== "reboot" || !(router.rebootMs > 0)) return undefined;
        router.rebooted = true;
        router.rebootCount = (router.rebootCount ?? 0) + 1;
        router.bootedAt = Date.now();
        const home = router.startLanIp;
        router.startLanIp = "reboot-in-progress";
        const timer = setTimeout(() => {
          router.startLanIp = home;
        }, router.rebootMs);
        timer.unref?.();
        return { stdout: "" };
      },
    ],
  },
};
