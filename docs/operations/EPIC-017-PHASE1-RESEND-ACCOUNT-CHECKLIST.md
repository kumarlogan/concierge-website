# Phase 1 — Production Email Infrastructure: Resend Account Checklist

**EPIC-017** — Production Email Activation & First Patient Certification
**Status:** READY FOR EXECUTION
**Owner:** Operations
**Date:** 2026-08-06

---

## 1.1 Create Resend Account

| Step | Action | Expected Result | Verification |
|------|--------|-----------------|--------------|
| 1.1.1 | Navigate to https://resend.com/signup | Account creation page loads | Visual confirmation |
| 1.1.2 | Register with company email (e.g., `admin@agsynergy.ca`) | Confirmation email sent | Check inbox |
| 1.1.3 | Verify email address | Account activated | Can log in |
| 1.1.4 | Complete organization setup (name: "AG Synergy") | Organization created | Dashboard shows "AG Synergy" |
| 1.1.5 | Upgrade to **Pro plan** ($20/mo) for production volume | Plan active | Billing page shows Pro |

> **Note:** Free tier = 3,000 emails/month. Pro = 50,000/month. For pilot, free tier may suffice but Pro removes daily limits.

---

## 1.2 Verify Domain: agsynergy.ca

| Step | Action | Expected Result | Verification |
|------|--------|-----------------|--------------|
| 1.2.1 | In Resend dashboard: Domains → Add Domain | Domain input form | Form visible |
| 1.2.2 | Enter `agsynergy.ca` | Domain added to list | Shows "Pending verification" |
| 1.2.3 | Copy provided DNS records (TXT, CNAME) | Records displayed | Screenshot/save records |
| 1.2.4 | Add records to Cloudflare DNS (see Phase 2) | DNS propagated | `dig` confirms records |
| 1.2.5 | Click "Verify" in Resend | Domain status → "Verified" | Green checkmark in Resend |

---

## 1.3 Configure Verified Sender

| Step | Action | Expected Result | Verification |
|------|--------|-----------------|--------------|
| 1.3.1 | In verified domain, add sender: `noreply@agsynergy.ca` | Sender created | Appears in senders list |
| 1.3.2 | (Optional) Add sender: `support@agsynergy.ca` | Sender created | Appears in senders list |
| 1.3.3 | (Optional) Add sender: `notifications@agsynergy.ca` | Sender created | Appears in senders list |
| 1.3.4 | Verify each sender receives test email | Test delivered | Check inbox/spam |

> **Recommendation:** Use `noreply@agsynergy.ca` as primary (EMAIL_FROM). Add others as aliases if needed.

---

## 1.4 Configure Support Address

| Step | Action | Expected Result | Verification |
|------|--------|-----------------|--------------|
| 1.4.1 | In Resend: Settings → Support address | Set to `support@agsynergy.ca` | Saved |
| 1.4.2 | Verify forwarding works | Email to support@ reaches inbox | Send test |

---

## 1.5 Configure Notification Address

| Step | Action | Expected Result | Verification |
|------|--------|-----------------|--------------|
| 1.5.1 | In Resend: Settings → Notification email | Set to `notifications@agsynergy.ca` | Saved |
| 1.5.2 | Test bounce/complaint notifications | Alerts received | Check inbox |

---

## 1.6 Generate Production API Key

| Step | Action | Expected Result | Verification |
|------|--------|-----------------|--------------|
| 1.6.1 | In Resend: API Keys → Create API Key | Key generated | Format: `re_xxxxxxxxxxxxxxxxxxxxxxxx` |
| 1.6.2 | Name key: `agsynergy-production` | Named | Visible in list |
| 1.6.3 | **Immediately copy and store securely** | Key saved | **Cannot be viewed again** |
| 1.6.4 | Restrict key to `agsynergy.ca` domain (if available) | Domain-scoped | Security best practice |

---

## 1.7 Validate Account Status

| Check | Command / Location | Expected |
|-------|-------------------|----------|
| Domain verified | Resend dashboard → Domains | Green "Verified" badge |
| Sender verified | Resend dashboard → Senders | Green "Verified" badge |
| API key works | `curl -H "Authorization: Bearer re_..." https://api.resend.com/emails` | 200 or 401 (not 403) |
| Sending limit | Resend dashboard → Usage | Shows plan limits |
| No blocks | Resend dashboard → Sending status | "Active" |

---

## 1.8 Deliverables

- [ ] Resend account created and on Pro plan
- [ ] `agsynergy.ca` domain verified in Resend
- [ ] `noreply@agsynergy.ca` sender verified
- [ ] Support address configured
- [ ] Notification address configured
- [ ] Production API key generated (`re_...`)
- [ ] Account status: **Active, Verified, No blocks**

---

## 1.9 Next Phase Dependency

**Phase 2 (DNS Validation) cannot proceed until:**
- Resend provides DKIM CNAME record (after domain verification)
- Resend provides SPF include directive
- MX records for Resend are known

> **Action Required:** Complete Phase 1, then proceed to Phase 2 with the DNS records from Resend.