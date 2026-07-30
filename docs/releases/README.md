# Release Documentation — AG Synergy Concierge

## Release Hierarchy

```
docs/releases/
├── README.md                          ← This index
├── PHASE_1_EXIT.md                    ← Platform Phase 1 closeout
├── v1.0.0_CERTIFICATION.md           ← Platform v1.0.0 production certification
└── concierge/                         ← Concierge product releases
    └── patient-portal/                ← Patient Portal module
        └── phase-1/                   ← Phase 1 releases
            └── rc1/                   ← Release Candidate 1
                ├── RELEASE_MANIFEST.md
                ├── CONCIERGE_PATIENT_PORTAL_RC1_VALIDATION.md
                ├── CONCIERGE_PATIENT_PORTAL_RC1_TEST_EVIDENCE.md
                ├── CONCIERGE_PATIENT_PORTAL_PHASE1_COMPLETION.md
                ├── CONCIERGE_PATIENT_PORTAL_RELEASE_NOTES_RC1.md
                ├── CONCIERGE_PATIENT_PORTAL_KNOWN_LIMITATIONS.md
                ├── CONCIERGE_PATIENT_PORTAL_PHASE2_READINESS.md
                └── POSTMORTEM_PHASE1.md
```

---

## Naming Convention

All release documents follow the naming convention:

```
CONCIERGE_<MODULE>_<RELEASE>_<DOCUMENT_TYPE>.md
```

| Component | Description | Examples |
|-----------|-------------|----------|
| **CONCIERGE_** | Fixed prefix — product brand | `CONCIERGE_` |
| **<MODULE>_** | Module name (e.g., `PATIENT_PORTAL`, `CLINIC_PORTAL`, `ADMIN_PORTAL`) | `PATIENT_PORTAL_` |
| **<RELEASE>_** | Release identifier (e.g., `RC1`, `PHASE1`, `PHASE2`) | `RC1_`, `PHASE1_` |
| **<DOCUMENT_TYPE>** | Document type (e.g., `VALIDATION`, `TEST_EVIDENCE`, `RELEASE_NOTES`, `KNOWN_LIMITATIONS`, `PHASE2_READINESS`, `COMPLETION`) | `VALIDATION.md` |

**Special documents** (non-prefixed, per-release):
- `RELEASE_MANIFEST.md` — Release index manifest
- `POSTMORTEM_PHASE<N>.md` — Engineering retrospective

---

## Folder Structure Pattern

```
docs/releases/
├── README.md
└── <platform>/
    └── <module>/
        └── <phase>/
            └── <release-candidate>/
                ├── RELEASE_MANIFEST.md
                ├── CONCIERGE_<MODULE>_<RELEASE>_VALIDATION.md
                ├── CONCIERGE_<MODULE>_<RELEASE>_TEST_EVIDENCE.md
                ├── CONCIERGE_<MODULE>_<PHASE>_COMPLETION.md
                ├── CONCIERGE_<MODULE>_RELEASE_NOTES_<RELEASE>.md
                ├── CONCIERGE_<MODULE>_KNOWN_LIMITATIONS.md
                ├── CONCIERGE_<MODULE>_<NEXT_PHASE>_READINESS.md
                └── POSTMORTEM_<PHASE>.md
```

---

## Latest Releases

| Module | Phase | Release | Status | Date |
|--------|-------|---------|--------|------|
| **Patient Portal** | Phase 1 | **RC1** | ✅ READY FOR LIMITED PILOT | 2026-07-29 |

---

## Future Release Guidance

When creating a new release package, follow this process:

1. **Create the folder structure** following the pattern above:
   ```
   docs/releases/<platform>/<module>/<phase>/<rc>/
   ```

2. **Copy the standard document set** from the previous release or template:
   - `RELEASE_MANIFEST.md` — Update release identity, status, git tag, commit SHA
   - `CONCIERGE_<MODULE>_<RELEASE>_VALIDATION.md` — Validation results
   - `CONCIERGE_<MODULE>_<RELEASE>_TEST_EVIDENCE.md` — Test evidence
   - `CONCIERGE_<MODULE>_<PHASE>_COMPLETION.md` — Phase completion report
   - `CONCIERGE_<MODULE>_RELEASE_NOTES_<RELEASE>.md` — Release notes
   - `CONCIERGE_<MODULE>_KNOWN_LIMITATIONS.md` — Known limitations
   - `CONCIERGE_<MODULE>_<NEXT_PHASE>_READINESS.md` — Next phase readiness
   - `POSTMORTEM_<PHASE>.md` — Engineering retrospective

3. **Update this README.md** to add the new release to the "Latest Releases" table.

4. **Run the validation checklist:**
   - ✓ All documents exist
   - ✓ All links resolve
   - ✓ Folder structure is correct
   - ✓ No duplicate files remain
   - ✓ File names are unique
   - ✓ Documentation is internally consistent

---

## Future Releases (Planned)

| Module | Phase | Release | Status |
|--------|-------|---------|--------|
| Patient Portal | Phase 2 | RC1 | 🔜 Planned |
| Clinic Portal | Phase 1 | RC1 | 📋 Not started |
| Admin Portal | Phase 1 | RC1 | 📋 Not started |
| Operations Portal | Phase 1 | RC1 | 📋 Not started |
| Public API | Phase 1 | RC1 | 📋 Not started |
| AI Services | Phase 1 | RC1 | 📋 Not started |
| Mobile Applications | TBD | RC1 | 📋 Not started |

---

*AG Synergy Release Documentation Standard (AGS-DOCS-001) · 2026-07-30*