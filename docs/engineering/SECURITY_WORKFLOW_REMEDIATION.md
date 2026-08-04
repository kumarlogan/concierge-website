# Security Workflow Remediation — Gitleaks Config

**Status:** ACTION REQUIRED — Human must apply this fix. The engineering integration
cannot write to .github/workflows/ (403 — lacks GitHub App workflows permission).

**Issue:** GAP-018 (catalogued in docs/context/KNOWN_GAPS.yaml)
The gitleaks security scan in .github/workflows/security.yml uses:
  GITLEAKS_CONFIG: ""
This empty string means the scan uses gitleaks built-in default rules WITHOUT
reading the repository-local .gitleaks.toml config. This means:
1. Our custom Cloudflare API token rule (cfat_ prefix) is not active.
2. Our allowlist paths are not active — CHANGELOG.md, docs/operations/ are scanned
   without exclusion and may generate false positives.

**Exact fix required** — change one line in .github/workflows/security.yml:



The .gitleaks.toml at repo root extends the default ruleset (useDefault = true) and
adds our Cloudflare token detector and allowlist. Setting GITLEAKS_CONFIG to point
to it restores the intended security scanning behaviour.

**After applying:** gitleaks will use .gitleaks.toml, the allowlist will exclude
CHANGELOG.md and the identified docs paths, and the Cloudflare token rule will be active.

**How to apply:**
git checkout main
# Edit .github/workflows/security.yml — change GITLEAKS_CONFIG: "" to GITLEAKS_CONFIG: ".gitleaks.toml"
git commit -m "fix(ci): point gitleaks to repository config (GAP-018)"
git push

**Who:** Any maintainer with repository write access and the GitHub App workflows permission.
