// EPIC-008 PHASE4 — Trust regression suite.
// Asserts the durable trust model (EPIC-005.6 / 005.8) behaves fail-closed:
//  • checksum integrity is enforced (tamper → reject)
//  • REAL ed25519 signature verification succeeds for a valid detached sig
//  • missing/unsigned/unknown/revoked/expired keys are rejected
// No core changes — pure behavior assertions against the real verifiers.
import { createHash, generateKeyPairSync, sign as cryptoSign } from "crypto";
import { RealSignatureVerifier, InMemorySignerRegistry } from "../signature/verifier.js";
import { RealChecksumVerifier, canonicalManifestBody } from "../checksum/checksum-verifier.js";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

function makeManifest(trust: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "prov.test",
    vendor: "test",
    version: "1.0.0",
    manifestSchema: "v2",
    transports: [{ kind: "local-process" }],
    capabilities: [],
    permissions: [],
    trust,
    ...extra,
  };
}

console.log("TRUST REGRESSION SUITE (checksum + ed25519 signature)");

// ── Checksum verifier ──────────────────────────────────────────
const cv = new RealChecksumVerifier();
{
  const body = canonicalManifestBody(makeManifest({ level: "untrusted" }) as never);
  const checksum = createHash("sha256").update(body).digest("hex");
  const good = makeManifest({ level: "untrusted", signature: { checksum } });
  check("valid checksum → ok", cv.verify(good as never).ok === true);

  const bad = makeManifest({ level: "untrusted", signature: { checksum: "deadbeef" } });
  const rb = cv.verify(bad as never);
  check("checksum mismatch → fail", rb.ok === false && /checksum mismatch/.test(rb.reason ?? ""));

  const nosig = makeManifest({ level: "untrusted" });
  check("missing checksum → fail", cv.verify(nosig as never).ok === false);
}

// ── Signature verifier (REAL ed25519) ──────────────────────────
{
  const reg = new InMemorySignerRegistry();
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pubPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  const exp = new Date(Date.now() + 86400000).toISOString();
  reg.activateKey("signer1", "key1", pubPem, exp);

  const sv = new RealSignatureVerifier(reg);

  // Build a signed manifest.
  const m = makeManifest({ level: "sandbox" });
  const body = canonicalManifestBody(m as never);
  const checksum = createHash("sha256").update(body).digest("hex");
  const sig = cryptoSign(null, Buffer.from(body, "utf8"), privateKey);
  const signed = makeManifest({
    level: "sandbox",
    signature: { signer: "signer1", keyId: "key1", value: sig.toString("base64"), checksum },
  });
  check("valid detached ed25519 sig → ok", sv.verify(signed as never).ok === true);

  // No signature block → authenticity unproven → fail-closed.
  const unsigned = makeManifest({ level: "sandbox" });
  const ru = sv.verify(unsigned as never);
  check("missing signature → fail", ru.ok === false && /signature missing/.test(ru.reason ?? ""));

  // Unknown signer → fail.
  const unknownSigner = makeManifest({
    level: "sandbox",
    signature: { signer: "ghost", keyId: "k", value: sig.toString("base64"), checksum },
  });
  const rk = sv.verify(unknownSigner as never);
  check("unknown signer → fail", rk.ok === false);

  // Revoked key → fail.
  reg.revokeKey("signer1", "key1");
  const rrev = sv.verify(signed as never);
  check("revoked key → fail", rrev.ok === false);

  // Re-activate an EXPIRED key → fail.
  reg.activateKey("signer1", "key1", pubPem, new Date(Date.now() - 1000).toISOString());
  const rexp = sv.verify(signed as never);
  check("expired key → fail", rexp.ok === false);
}

console.log(`\nTRUST: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
