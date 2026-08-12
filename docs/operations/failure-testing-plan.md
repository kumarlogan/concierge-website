# Failure Testing Plan — AG Synergy Email Infrastructure

**Purpose:** Validate that all email failure scenarios return safe, user-friendly messages.

**Last Updated:** 2026-08-05

---

## Test Matrix

| # | Scenario | Expected Behavior | User Message | Safe? |
|---|----------|-------------------|-------------|-------|
| 1 | Expired verification token | Verification fails gracefully | "This verification link has expired. Please request a new verification email." | Yes |
| 2 | Invalid token | Verification fails gracefully | "Invalid verification link. Please check the link and try again." | Yes |
| 3 | Reused token | Verification fails gracefully | "This verification link has already been used." | Yes |
| 4 | Missing token | Verification fails gracefully | "No verification token provided. Please check your email for the verification link." | Yes |
| 5 | Provider unavailable | Email send fails gracefully | "Unable to send email at this time. Please try again later." | Yes |
| 6 | Rate limiting | Email send throttled gracefully | "Too many email requests. Please wait a moment and try again." | Yes |
| 7 | Email retry | Transient failures retried | "Email sent successfully." (after retry succeeds) | Yes |
| 8 | Bounce handling | Bounced email tracked | N/A (server-side) — user notified via in-app alert | Yes |
| 9 | Delivery failure | Failed delivery tracked | N/A (server-side) — user notified via in-app alert | Yes |

---

## Detailed Test Procedures

### 1. Expired Verification Token

**Setup:** Register a user, wait for verification token to expire (or manipulate token expiry).

**Steps:**
1. Register new account
2. Wait for token to expire (or use expired token)
3. Open verification link

**Expected:**
- HTTP 400 or 410
- Response: `{ success: false, error: { code: "TOKEN_EXPIRED", message: "This verification link has expired. Please request a new verification email." } }`
- No stack trace or internal details exposed

---

### 2. Invalid Token

**Setup:** Register a user, use a randomly generated invalid token.

**Steps:**
1. Register new account
2. Navigate to verification page with random token: `/identity/email/verify?token=invalid-token-123`

**Expected:**
- HTTP 400
- Response: `{ success: false, error: { code: "INVALID_TOKEN", message: "Invalid verification link. Please check the link and try again." } }`
- No stack trace or internal details exposed

---

### 3. Reused Token

**Setup:** Register a user, verify email successfully, then try to use the same token again.

**Steps:**
1. Register new account
2. Open verification link (first use)
3. Open the same verification link again (reuse)

**Expected:**
- HTTP 400
- Response: `{ success: false, error: { code: "TOKEN_ALREADY_USED", message: "This verification link has already been used." } }`
- No stack trace or internal details exposed

---

### 4. Missing Token

**Setup:** Navigate to verification endpoint without a token parameter.

**Steps:**
1. Navigate to `/identity/email/verify` (no token query param)

**Expected:**
- HTTP 400
- Response: `{ success: false, error: { code: "MISSING_TOKEN", message: "No verification token provided. Please check your email for the verification link." } }`
- No stack trace or internal details exposed

---

### 5. Provider Unavailable

**Setup:** Stop Resend service or block Resend API endpoint.

**Steps:**
1. Attempt to send verification email
2. Observe the error response

**Expected:**
- HTTP 503 or 500
- Response: `{ success: false, error: { code: "EMAIL_SERVICE_UNAVAILABLE", message: "Unable to send email at this time. Please try again later." } }`
- No stack trace or internal details exposed
- No Resend API key or other secret in error response

---

### 6. Rate Limiting

**Setup:** Send many verification emails in rapid succession.

**Steps:**
1. Send 10+ verification emails within 1 minute
2. Observe the response for the 11th request

**Expected:**
- HTTP 429
- Response: `{ success: false, error: { code: "RATE_LIMITED", message: "Too many email requests. Please wait a moment and try again." } }`
- No stack trace or internal details exposed

---

### 7. Email Retry

**Setup:** Simulate a transient failure (e.g., network timeout).

**Steps:**
1. Attempt to send verification email
2. Observe retry behavior
3. Verify eventual success or graceful failure

**Expected:**
- Transient failures are retried (exponential backoff recommended)
- If retry succeeds: `{ success: true, message: "Verification email sent" }`
- If all retries fail: `{ success: false, error: { code: "EMAIL_SEND_FAILED", message: "Unable to send email at this time. Please try again later." } }`

---

### 8. Bounce Handling

**Setup:** Send email to an invalid address that will bounce.

**Steps:**
1. Send verification email to invalid address (e.g., `nonexistent@invalid-domain-xyz.com`)
2. Monitor Resend dashboard for bounce
3. Check in-app notification for user

**Expected:**
- Resend dashboard shows bounce
- Bounce is logged in delivery log
- User is notified via in-app alert (not via email, to avoid bounce loop)
- No error exposed to the user at the API level (the send appeared successful; the bounce is handled asynchronously)

---

### 9. Delivery Failure

**Setup:** Simulate a delivery failure (e.g., Resend returns 500).

**Steps:**
1. Mock Resend API to return 500
2. Attempt to send verification email
3. Observe the error response

**Expected:**
- HTTP 500 or 503
- Response: `{ success: false, error: { code: "EMAIL_SEND_FAILED", message: "Unable to send email at this time. Please try again later." } }`
- No Resend error details or stack trace exposed
- No API key or internal details in response

---

## Safe Response Requirements

All error responses MUST:

1. Return a generic, user-friendly message
2. NOT expose internal error details, stack traces, or provider-specific error messages
3. NOT expose secrets (API keys, tokens, internal identifiers)
4. Use appropriate HTTP status codes (400 for client errors, 503 for service unavailable)
5. Include a machine-readable `code` field for programmatic handling
6. Include a human-readable `message` field for display

---

## Unsafe Response Examples (MUST NOT occur)

```json
// BAD — exposes internal details
{ "error": "Resend API returned 401: Invalid API key re_xxxx..." }

// BAD — exposes stack trace
{ "error": "TypeError: fetch failed\n    at EmailService.sendEmail (email-service.ts:42:15)\n    ..." }

// BAD — exposes secrets
{ "error": "Authorization failed. Key: re_xxxxxxxxxxxxxxxxxxxxxxxx" }
```

---

## Pass Criteria

- All 9 failure scenarios return safe, user-friendly messages
- No internal details, stack traces, or secrets exposed in any error response
- Appropriate HTTP status codes for each scenario
- Retry logic works for transient failures
- Bounce handling does not create email loops