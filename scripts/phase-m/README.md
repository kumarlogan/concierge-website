# Phase M — Hybrid Operator Production Replay (Runbook)

> **Execution-plane separation — NOT a relaxation of security.** Hermes remains the
> governance/orchestration/validation/certification plane. The operator's ordinary consumer
> device is the execution plane. Production HTTP requests are made **only** from the
> operator's device, never from the Hermes host.

## Hybrid model

```
HERMES  (governance / orchestration / analysis / certification)
  │  prepares, validates, packages, instructs, analyzes
  ▼
scripts/phase-m/operator-production-replay.mjs   ← this package
  │  transferred to operator device
  ▼
OPERATOR CONSUMER DEVICE  (clean residential/consumer egress, operator inbox)
  │  register → email verify → login → run matrix  ▸  api.agsynergy.ca
  ▼
phase-m-production-evidence.json  +  phase-m-production-report.md
  │  returned to Hermes
  ▼
HERMES  → validates evidence → certifies Phase M
```

## The stop-condition reconciliation

- **"Do NOT use the Hermes orchestration host as the execution substrate"** — unchanged and
  still binding. Hermes never issues a production HTTP request for this validation.
- **"Hermes may prepare, validate, package, instruct, and analyze a production replay that
  is executed by the operator on a separate trusted consumer device/network"** — the new,
  explicit, documented affordance created by this hybrid model.
- Hybrid operator execution is permitted because Hermes remains the control/governance
  plane while the production HTTP execution occurs entirely outside the Hermes host from a
  separately trusted consumer network. The operator's device is treated as an execution
  plane, not as Hermes; the evidence must show requests originated from the consumer network.

## Security invariants (enforced)

- No `JWT_PRIVATE_KEY` / production signing material is read, exported, printed, or
  transferred. Authentication flows through the **real production login** only.
- No Authorization headers, JWTs, refresh tokens, passwords, verification tokens, or
  cookies are printed. Secrets are held in process memory only and redacted in all output
  and evidence artifacts.
- No Cloudflare change, no WAF bypass, no Bot-Fight-Mode disable, no DNS/grey-cloud change.
- No direct production D1 modification.
- No Hermes filesystem/network dependency.

## Operator prerequisites (≤ 3 items)

1. **A normal consumer/residential internet connection** (clean egress, not datacenter).
2. **Node.js ≥ 18 installed** (24 recommended) on the operator's device.
3. **A test inbox** that can receive production verification emails — and authority to use
   (or register + verify) **two synthetic patient identities**.

## Operator command

```bash
node scripts/phase-m/operator-production-replay.mjs \
  --patientA "patientA+synthetic@example.com" --passwordA "UseAStrongSyntheticPassword" \
  --patientB "patientB+synthetic@example.com" --passwordB "UseAStrongSyntheticPassword"
```

If the two accounts are **already registered and verified**, the script uses them directly
(it attempts login first). If not, the script registers each patient through the production
flow and **prompts you to paste the verification token** from the test inbox (redacted
input) before continuing.

Optional flags:
- `--no-verify` — skip email verification (marks patients unverified; production validation
  of verified logins should NOT use this).
- `--outdir <path>` — where the evidence artifacts are written (default `./phase-m-evidence`).

## What the script does (order)

1. **Preflight** — confirms target `api.agsynergy.ca`, captures public egress IP,
   `GET /api/v1/health`, records Cloudflare edge classification. Stops if the consumer IP
   is Managed-Challenged.
2. **Patient A/B acquisition** — production register → email verify (operator pastes code) →
   login (tokens held in memory only).
3. **Auth + /identity/me** — A and B tokens accepted (200).
4. **Token security** — missing / malformed / invalid / altered / `alg:none` → 401.
5. **Cross-patient resource isolation** — A→A and B→B ALLOW.
6. **Consent grants** — A→A and B→B → 201.
7. **Cross-patient consent grant attacks** — A→B and B→A → 403 **+ zero-mutation proof**
   (target history fingerprint before vs after attack).
8. **Cross-patient consent revoke attacks** — A→B and B→A → 403 **+ zero-mutation proof**.
9. **Consent history scoping** — A→B and B→A history → 403.
10. **Logout / session revocation** — A logout → session revoked.

## Output artifacts

- `phase-m-production-evidence.json` — structured matrix: test IDs, expected vs actual,
  Cloudflare edge classification, mutation-before/after, no-secret confirmation, overall.
- `phase-m-production-report.md` — human-readable matrix + secret audit.
- No credentials, no raw JWTs, no Authorization headers in either artifact.

## Hermes return path (post-operator)

1. Validate evidence integrity (schema, coherent statuses, no secret material).
2. Confirm the source egress/IP is the consumer plane (not the Hermes host IP).
3. Confirm the target hostname is the live `api.agsynergy.ca`.
4. Confirm no prohibited Hermes-host execution occurred.
5. Check all Phase M gates against Phase L evidence.
6. Identify any new Critical/High findings.
7. Update certification documentation.

**Hermes is the certification authority.** A script exit code of 0 does NOT by itself
certify Phase M GREEN — it only means operator execution completed. Hermes performs the
final certification after validating the returned evidence.
