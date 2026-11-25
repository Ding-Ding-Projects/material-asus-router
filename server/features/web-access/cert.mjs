// Pure readers for the web-access feature: the certificate read-out and the
// list of addresses allowed to open the router's page.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// openssl prints dates like "Mar  1 12:00:00 2027 GMT". Returns milliseconds, or null.
export function parseOpensslDate(text) {
  const m = String(text).trim().match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})\s+GMT$/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  return month < 0 ? null : Date.UTC(Number(m[6]), month, Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
}

// Output of: openssl x509 -in FILE -noout -subject -issuer -enddate
export function parseCertificate(text, now = Date.now()) {
  const field = (name) => String(text).split("\n").map((l) => l.trim()).find((l) => l.startsWith(`${name}=`))?.slice(name.length + 1).trim() ?? "";
  const end = parseOpensslDate(field("notAfter"));
  if (end === null) return { found: false };
  const subject = field("subject");
  const issuer = field("issuer");
  const daysLeft = Math.floor((end - now) / 86400000);
  const tone = daysLeft < 0 ? "expired" : daysLeft <= 7 ? "urgent" : daysLeft <= 30 ? "soon" : "fine";
  return {
    found: true,
    subject: subject.slice(0, 200),
    issuer: issuer.slice(0, 200),
    expires: new Date(end).toISOString(),
    daysLeft,
    tone,
    letsEncrypt: /let'?s encrypt/i.test(issuer),
    selfSigned: subject !== "" && subject === issuer,
  };
}

const OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const ADDRESS = new RegExp(`^${OCTET}(\\.${OCTET}){3}(/(\\d|[12]\\d|3[0-2]))?$`);

// One allowed address or network, such as 198.51.100.20 or 198.51.100.0/24. Networks wider than /8 are refused,
// because "everyone" is what the list exists to prevent.
export function isAllowedClient(item) {
  if (!ADDRESS.test(item)) return false;
  const prefix = item.includes("/") ? Number(item.split("/")[1]) : 32;
  return prefix >= 8;
}

export const clientItems = (value) => String(value ?? "").split("<").filter(Boolean);
