// ssh2's ed25519 key generator occasionally (about 1 in 200) writes a private
// key that its own parser rejects. Generate again until the key reads back.
import ssh2 from "ssh2";

const { utils } = ssh2;

export function generateEd25519() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const pair = utils.generateKeyPairSync("ed25519");
    const parsed = utils.parseKey(pair.private);
    if (!(parsed instanceof Error)) return pair;
  }
  throw new Error("Could not generate an SSH key.");
}
