// The household: people, their weekly schedule and how much disturbance each
// will put up with, with presence taken only from the home Wi-Fi client list
// and from Home Assistant entities the owner picked. The behaviour lives in
// server/changes/household.mjs; this folder adds the screen's data and the
// pretend router's Wi-Fi client list.
//
// The HTTP API is /api/household/*, documented in docs/articles/change-safety.md.
import { L } from "../kit.mjs";

export default {
  id: "household",

  domainMeta: [{ id: "household", icon: "family_restroom", label: L("Household", "屋企人"), group: { en: "Safety", yue: "安全" } }],
  domains: {
    household: async (ctx) => {
      const saved = ctx.session.store.read().household;
      return { people: saved ? saved.members.length : 1, madness: saved?.madness ?? 1 };
    },
  },

  fakeRouter: {
    handlers: [
      // `router.assoc = { eth6: ["F0:18:98:AA:BB:01"], eth7: [] }` sets who is on each Wi-Fi network
      // (an interface that is not listed has nobody on it). Without it, the pretend router's own list answers.
      (command, router) => {
        const m = /^wl -i ([A-Za-z0-9._-]+) assoclist$/.exec(command);
        if (!m || !router.assoc) return undefined;
        const macs = router.assoc[m[1]] ?? [];
        return { stdout: macs.map((mac) => `assoclist ${mac}\n`).join("") };
      },
    ],
  },
};
