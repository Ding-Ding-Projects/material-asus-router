// Decides which settings hold secrets so they are masked everywhere they
// could be shown, logged or stored in the clear.
export const MASK = "••••••••";
const SECRET_KEY = /psk|passw|authkey|secret|token|key/i;

export const isSecretKey = (key) => SECRET_KEY.test(String(key));
export const isSecret = (key, entry) => Boolean(entry?.secret) || isSecretKey(key);
export const mask = (value) => (value === undefined || value === null || value === "" ? "" : MASK);
