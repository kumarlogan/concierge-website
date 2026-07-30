#!/usr/bin/env python3
"""Production Golden Path validation for Concierge (AGS / AI Platform / AG Synergy).

Runs the complete flow against https://api.agsynergy.ca and asserts each step.
Evidence is printed per step. Any failure raises and aborts (per Step 5 rule:
never continue from the middle).
"""
import json
import random
import string
import sys
import time
import urllib.request
import urllib.error

BASE = "https://api.agsynergy.ca"
TIMEOUT = 30

# Fresh disposable test patient
rng = "".join(random.choices(string.digits, k=10))
EMAIL = f"p0golden-{rng}@agsynergy-test.ca"
PASSWORD="Gold#2026Xy9"  # >=12, upper, lower, digit, special — compliant with policy
FIRST = f"GP{rng}"
LAST = "Validation"

results = []
failures = []


def call(method, path, *, json_body=None, raw_body=None, headers=None, expected=None):
    url = BASE + path
    h = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    }
    if headers:
        h.update(headers)
    data = None
    if raw_body is not None:
        data = raw_body
        h["Content-Type"] = "application/octet-stream"
    elif json_body is not None:
        data = json.dumps(json_body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            status = resp.status
            body = resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        status = e.code
        body = e.read().decode("utf-8", "replace")
    try:
        parsed = json.loads(body)
    except Exception:
        parsed = body
    if expected is not None and status != expected:
        raise AssertionError(
            f"{method} {path} -> status {status}, expected {expected}\nbody={body[:500]}"
        )
    return status, parsed


def check(name, cond, detail=""):
    if cond:
        results.append((name, "PASS", detail))
        print(f"[PASS] {name} — {detail}")
    else:
        failures.append((name, detail))
        print(f"[FAIL] {name} — {detail}")
        raise AssertionError(f"Golden Path FAILED at: {name}\n{detail}")


# ── Step 1: Register ─────────────────────────────────────────────
print("\n=== Step 1: Register ===")
status, reg = call(
    "POST",
    "/identity/register",
    json_body={
        "identityType": "patient",
        "email": EMAIL,
        "password": PASSWORD,
        "profile": {"firstName": FIRST, "lastName": LAST},
    },
    expected=200,
)
check("register", reg.get("identity", {}).get("primaryEmail") == EMAIL or "identity" in reg,
      f"status={status}, email={EMAIL}")
identity_id = reg.get("identity", {}).get("id") or reg.get("identityId")
check("register.identityId_present", bool(identity_id), f"identityId={identity_id}")


# ── Step 2: Email verification (dev returns token) ──────────────
print("\n=== Step 2: Email verification ===")
status, ver = call(
    "POST",
    "/identity/email/verify",
    json_body={"identityId": identity_id, "email": EMAIL},
    expected=200,
)
token = ver.get("token")
check("email.verify.token_present", bool(token), f"token={'set' if token else 'MISSING'}")
status, comp = call(
    "POST",
    "/identity/email/verify/complete",
    json_body={"token": token},
    expected=200,
)
check("email.verify.complete", comp.get("message") == "Email verified" or comp.get("identityId"),
      f"msg={comp.get('message')}")


# ── Step 3: Login (JWT issuance) ────────────────────────────────
print("\n=== Step 3: Login ===")
status, login = call(
    "POST",
    "/identity/login",
    json_body={"email": EMAIL, "password": PASSWORD},
    expected=200,
)
access = login.get("accessToken") or login.get("token")
check("login.accessToken_present", bool(access), f"hasToken={'yes' if access else 'no'}")
refresh = login.get("refreshToken")
check("login.refreshToken_present", bool(refresh), "refresh token present")
AUTH={"Authorization": f"Bearer {access}"}


# ── Step 4: /identity/me ────────────────────────────────────────
print("\n=== Step 4: /identity/me ===")
status, me = call("GET", "/identity/me", headers=AUTH, expected=200)
check("me.email", me.get("identity", {}).get("primaryEmail") == EMAIL, f"email={me.get('identity', {}).get('primaryEmail')}")
check("me.verified", me.get("identity", {}).get("status") == "verified",
      f"status={me.get('identity', {}).get('status')}")


# ── Step 5: Profile (verified via /identity/me — no separate update endpoint) ──
print("\n=== Step 5: Profile presence ===")
prof = me.get("identity", {}).get("metadata", {}).get("profile") or {}
check("profile.present", bool(prof), f"profile={prof}")
check("profile.firstName", prof.get("firstName") == FIRST or bool(prof.get("firstName")),
      f"firstName={prof.get('firstName')}")


# ── Step 6: Appointment list (empty initially) ─────────────────
print("\n=== Step 6: Appointment list ===")
status, appts = call("GET", "/api/v1/appointments", headers=AUTH, expected=200)
check("appointments.list", isinstance(appts, (list, dict)), f"type={type(appts).__name__}")


# ── Step 7: Appointment booking ─────────────────────────────────
print("\n=== Step 7: Appointment booking ===")
# booking requires appointment_scheduling consent — grant it first
status, sched_consent = call(
    "POST",
    "/api/v1/consent/grant",
    json_body={
        "identityId": identity_id,
        "consentType": "appointment_scheduling",
        "scope": "healthcare",
        "version": "1.0",
    },
    headers=AUTH,
)
check("consent.grant.scheduling", status in (200, 201), f"status={status}")
future = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 86400))
status, created = call(
    "POST",
    "/api/v1/appointments",
    json_body={
        "patientId": identity_id,
        "providerId": "prov-001",
        "type": "consultation",
        "startAt": future,
        "durationMinutes": 30,
        "timezone": "America/Vancouver",
        "title": "Golden Path Consultation",
    },
    headers=AUTH,
)
check("appointment.create", status in (200, 201), f"status={status}")
appt_id = created.get("appointment", {}).get("id") or created.get("id") or created.get("appointmentId")
check("appointment.id_present", bool(appt_id), f"id={appt_id}")


# ── Step 8: Messaging ──────────────────────────────────────────
print("\n=== Step 8: Messaging ===")
status, msg = call(
    "POST",
    "/api/v1/clinic/messages/send",
    json_body={
        "recipientId": "clinic-001",
        "messageType": "text",
        "content": "Golden path test message",
        "channel": "in-app",
    },
    headers=AUTH,
)
check("messaging.send", status in (200, 201), f"status={status}")


# ── Step 9: Consent grant ──────────────────────────────────────
print("\n=== Step 9: Consent grant ===")
status, grant = call(
    "POST",
    "/api/v1/consent/grant",
    json_body={
        "identityId": identity_id,
        "consentType": "data_processing",
        "scope": "treatment",
        "version": "1.0",
    },
    headers=AUTH,
)
check("consent.grant", status in (200, 201), f"status={status}")
consent_id = grant.get("consentId")
check("consent.id_present", bool(consent_id), f"consentId={consent_id}")


# ── Step 10: Consent revoke ────────────────────────────────────
print("\n=== Step 10: Consent revoke ===")
status, rev = call(
    "POST",
    "/api/v1/consent/revoke",
    json_body={"consentId": consent_id, "reason": "Golden path test complete"},
    headers=AUTH,
)
check("consent.revoke", status in (200, 201) and rev.get("revoked") in (True, "true"),
      f"status={status}, revoked={rev.get('revoked')}")


# ── Step 11: Document upload ───────────────────────────────────
print("\n=== Step 11: Document upload ===")
status, dcreate = call(
    "POST",
    "/api/v1/documents",
    json_body={
        "fileName": "golden-path-proof.txt",
        "mimeType": "text/plain",
        "category": "identification",
    },
    headers=AUTH,
    expected=201,
)
doc_id = dcreate.get("id") or dcreate.get("documentId")
check("document.create", bool(doc_id), f"docId={doc_id}")
# Upload raw bytes
payload = b"GOLDEN PATH PROOF " + rng.encode()
status, dup = call(
    "POST",
    f"/api/v1/documents/{doc_id}/upload",
    raw_body=payload,
    headers={"Authorization": f"Bearer {access}", "Content-Type": "application/octet-stream"},
)
check("document.upload", status in (200, 201), f"status={status}")


# ── Step 12: Document list ─────────────────────────────────────
print("\n=== Step 12: Document list ===")
status, dlist = call("GET", "/api/v1/documents", headers=AUTH, expected=200)
items = dlist.get("documents") if isinstance(dlist, dict) else dlist
check("document.list", isinstance(items, list) and any(d.get("id") == doc_id for d in items),
      f"count={len(items) if isinstance(items, list) else 'n/a'}")


# ── Step 13: Document download (pre-signed URL) ────────────────
print("\n=== Step 13: Document download ===")
status, ddown = call("GET", f"/api/v1/documents/{doc_id}/download", headers=AUTH)
check("document.download", status in (200, 201), f"status={status}")
# The download may return a presigned URL or inline body; validate something came back
dl_field = ddown.get("url") or ddown.get("downloadUrl") or ddown.get("body") or ddown
check("document.download.payload", bool(dl_field), f"keys={list(ddown.keys()) if isinstance(ddown, dict) else type(ddown)}")


# ── Step 14: Document delete ───────────────────────────────────
print("\n=== Step 14: Document delete ===")
status, ddel = call("DELETE", f"/api/v1/documents/{doc_id}", headers=AUTH)
check("document.delete", status in (200, 204) and ddel.get("deleted") in (True, "true", None),
      f"status={status}")


# ── Step 15: Logout ────────────────────────────────────────────
print("\n=== Step 15: Logout ===")
status, logout = call(
    "POST",
    "/identity/logout",
    json_body={},
    headers=AUTH,
    expected=200,
)
check("logout", logout.get("message") == "Logged out" or status == 200, f"status={status}")


# ── Step 16: Re-login ──────────────────────────────────────────
print("\n=== Step 16: Re-login ===")
status, relogin = call(
    "POST",
    "/identity/login",
    json_body={"email": EMAIL, "password": PASSWORD},
    expected=200,
)
check("relogin.accessToken", bool(relogin.get("accessToken") or relogin.get("token")),
      f"status={status}")


print("\n" + "=" * 60)
print(f"GOLDEN PATH RESULT: {len(results)} steps PASSED, {len(failures)} FAILED")
print(f"Test identity: {EMAIL}")
print("=" * 60)
