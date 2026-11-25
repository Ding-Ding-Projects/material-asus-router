// The pretend router's half of this feature: the mode settings a router like this lists,
// and a restart that is only recorded (the pretend router stays reachable).
export const fake = {
  nvram: { sw_mode: "1", wlc_psta: "0", wlc_ssid: "Upstream Home", re_mode: "0", wl_mlo_enable: "0" },
  handlers: [
    (command, router) => {
      if (command === "service reboot") {
        router.rebooted = true;
        (router.services ??= []).push("reboot");
        return {};
      }
      return undefined;
    },
  ],
};
