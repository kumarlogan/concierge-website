# EPIC-016: Email Infrastructure & Patient Activation — Implementation Plan

> **For Hermes:** Use feature-milestone-execution skill to implement this plan task-by-task.

**Goal:** Implement a production-grade transactional email capability for AG Synergy that enables the complete first patient journey (register → verify → login → full journey). Transition from 🔴 RED to 🟡 PILOT READY.

**Architecture:** Routes → Business Services → EmailService → EmailProvider → ResendProvider
**Tech Stack:** Cloudflare Workers (TypeScript), Resend (transactional email), Cloudflare Email Routing, D1 (token storage), Wrangler

---

## Phase 0: EPCL Entry Gate (already passed)
- [x] Repository integrity verified
- [x] All 12 dimensions passed in prior validation
- [x] Current state: RED — email delivery not implemented

## Phase 1: WAS Workforce Activation

### Task 1: Design Email Provider Abstraction
**Objective:** Create the EmailProvider interface that decouples business logic from the email provider.

**Files:**
- Create: `workers/src/platform/email/email-provider.ts`

**Step 1: Define the EmailProvider interface**
```typescript
export interface EmailProvider {
  name: string;
  sendEmail(to: string, subject: string, html: string, text: string): Promise<SendResult>;
  getProviderHealth(): Promise<ProviderHealth>;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerLatencyMs: number;
}

export interface ProviderHealth {
  status: "healthy" | "degraded" | "unavailable";
  providerName: string;
  lastChecked: string;
  latencyMs: number;
}
```

**Step 2: Run typecheck to verify no errors**
Run: `cd /home/ubuntu/concierge-website && npx tsc --noEmit -p workers/tsconfig.json 2>&1 | tail -5`
Expected: No new errors from this file

**Step 3: Commit**
```bash
git add workers/src/platform/email/email-provider.ts
git commit -m "feat(email): add EmailProvider interface"
```

---

### Task 2: Implement ResendProvider
**Objective:** Create the ResendProvider concrete implementation of EmailProvider.

**Files:**
- Create: `workers/src/platform/email/resend-provider.ts`

**Step 1: Implement ResendProvider**
```typescript
import { EmailProvider, SendResult, ProviderHealth } from "./email-provider.js";

export class ResendProvider implements EmailProvider {
  name = "resend";
  private apiKey: string;
  private fromAddress: string;

  constructor(apiKey: string, fromAddress: string) {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  async sendEmail(to: string, subject: string, html: string, text: string): Promise<SendResult> {
    const startTime = Date.now();
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: errorBody, providerLatencyMs: latency };
      }

      const data = await response.json();
      return { success: true, messageId: data.id, providerLatencyMs: latency };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err), providerLatencyMs: Date.now() - startTime };
    }
  }

  async getProviderHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      const response = await fetch("https://api.resend.com/v1/emails", {
        headers: { "Authorization": `Bearer ${this.apiKey}` },
      });
      return {
        status: response.ok ? "healthy" : "degraded",
        providerName: this.name,
        lastChecked: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      };
    } catch {
      return {
        status: "unavailable",
        providerName: this.name,
        lastChecked: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      };
    }
  }
}
```

**Step 2: Typecheck**
Run: `npx tsc --noEmit -p workers/tsconfig.json 2>&1 | tail -5`

**Step 3: Commit**
```bash
git add workers/src/platform/email/resend-provider.ts
git commit -m "feat(email): add ResendProvider implementation"
```

---

### Task 3: Create EmailService (Business Layer)
**Objective:** Create the EmailService that routes email requests through the provider abstraction.

**Files:**
- Create: `workers/src/platform/email/email-service.ts`

**Step 1: Implement EmailService**
```typescript
import { EmailProvider, SendResult } from "./email-provider.js";

export interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text: string;
  templateName?: string;
  referenceId?: string;
}

export interface EmailDeliveryRecord {
  id: string;
  referenceId: string;
  templateName: string;
  to: string;
  subject: string;
  status: "requested" | "sent" | "failed";
  providerMessageId?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export class EmailService {
  private provider: EmailProvider;
  private deliveryLog: EmailDeliveryRecord[] = [];

  constructor(provider: EmailProvider) {
    this.provider = provider;
  }

  async sendEmail(request: EmailRequest): Promise<SendResult> {
    const record: EmailDeliveryRecord = {
      id: crypto.randomUUID(),
      referenceId: request.referenceId || "",
      templateName: request.templateName || "unknown",
      to: request.to,
      subject: request.subject,
      status: "requested",
      createdAt: new Date().toISOString(),
    };
    this.deliveryLog.push(record);

    const result = await this.provider.sendEmail(request.to, request.subject, request.html, request.text);

    record.status = result.success ? "sent" : "failed";
    record.providerMessageId = result.messageId;
    record.error = result.error;
    record.completedAt = new Date().toISOString();

    return result;
  }

  getDeliveryLog(): readonly EmailDeliveryRecord[] {
    return this.deliveryLog;
  }

  getProviderHealth() {
    return this.provider.getProviderHealth();
  }
}
```

**Step 2: Typecheck**
Run: `npx tsc --noEmit -p workers/tsconfig.json 2>&1 | tail -5`

**Step 3: Commit**
```bash
git add workers/src/platform/email/email-service.ts
git commit -m "feat(email): add EmailService with delivery tracking"
```

---

### Task 4: Create HTML and Plain Text Email Templates
**Objective:** Implement HTML and plain text renderers for verification, password reset, and confirmation emails.

**Files:**
- Create: `workers/src/platform/email/templates/verification.ts`
- Create: `workers/src/platform/email/templates/password-reset.ts`
- Create: `workers/src/platform/email/templates/consultation-confirmation.ts`
- Create: `workers/src/platform/email/templates/appointment-confirmation.ts`
- Create: `workers/src/platform/email/templates/document-upload.ts`
- Create: `workers/src/platform/email/templates/notification.ts`

**Step 1: Verification email template**
```typescript
// workers/src/platform/email/templates/verification.ts
export function renderVerificationEmail(verificationUrl: string, patientName: string): { html: string; text: string; subject: string } {
  const subject = "Verify your AG Synergy account";
  const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Welcome to AG Synergy</h1>
    <p>Hello ${patientName},</p>
    <p>Please verify your email address by clicking the link below:</p>
    <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a>
    <p>This link expires in 24 hours.</p>
    <p>If you did not create this account, please ignore this email.</p>
  </body></html>`;
  const text = `Hello ${patientName},\n\nPlease verify your email address by visiting: ${verificationUrl}\n\nThis link expires in 24 hours.\n\nIf you did not create this account, please ignore this email.`;
  return { html, text, subject };
}
```

**Step 2: Password reset template**
```typescript
// workers/src/platform/email/templates/password-reset.ts
export function renderPasswordResetEmail(resetUrl: string, patientName: string): { html: string; text: string; subject: string } {
  const subject = "Reset your AG Synergy password";
  const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Password Reset</h1>
    <p>Hello ${patientName},</p>
    <p>Click the link below to reset your password:</p>
    <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a>
    <p>This link expires in 1 hour.</p>
    <p>If you did not request a password reset, please ignore this email.</p>
  </body></html>`;
  const text = `Hello ${patientName},\n\nClick the link below to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you did not request a password reset, please ignore this email.`;
  return { html, text, subject };
}
```

**Step 3: Consultation confirmation template**
```typescript
// workers/src/platform/email/templates/consultation-confirmation.ts
export function renderConsultationConfirmation(consultationDetails: { date: string; time: string; doctor: string; patientName: string }): { html: string; text: string; subject: string } {
  const subject = "Your consultation is confirmed";
  const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Consultation Confirmed</h1>
    <p>Hello ${consultationDetails.patientName},</p>
    <p>Your consultation has been confirmed:</p>
    <ul>
      <li><strong>Date:</strong> ${consultationDetails.date}</li>
      <li><strong>Time:</strong> ${consultationDetails.time}</li>
      <li><strong>Doctor:</strong> ${consultationDetails.doctor}</li>
    </ul>
    <p>We look forward to seeing you.</p>
  </body></html>`;
  const text = `Hello ${consultationDetails.patientName},\n\nYour consultation has been confirmed:\nDate: ${consultationDetails.date}\nTime: ${consultationDetails.time}\nDoctor: ${consultationDetails.doctor}\n\nWe look forward to seeing you.`;
  return { html, text, subject };
}
```

**Step 4: Appointment confirmation template**
```typescript
// workers/src/platform/email/templates/appointment-confirmation.ts
export function renderAppointmentConfirmation(details: { date: string; time: string; type: string; patientName: string }): { html: string; text: string; subject: string } {
  const subject = "Your appointment is confirmed";
  const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Appointment Confirmed</h1>
    <p>Hello ${details.patientName},</p>
    <p>Your appointment has been confirmed:</p>
    <ul>
      <li><strong>Date:</strong> ${details.date}</li>
      <li><strong>Time:</strong> ${details.time}</li>
      <li><strong>Type:</strong> ${details.type}</li>
    </ul>
  </body></html>`;
  const text = `Hello ${details.patientName},\n\nYour appointment has been confirmed:\nDate: ${details.date}\nTime: ${details.time}\nType: ${details.type}`;
  return { html, text, subject };
}
```

**Step 5: Document upload confirmation template**
```typescript
// workers/src/platform/email/templates/document-upload.ts
export function renderDocumentUploadConfirmation(patientName: string, documentType: string): { html: string; text: string; subject: string } {
  const subject = "Your documents have been received";
  const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Documents Received</h1>
    <p>Hello ${patientName},</p>
    <p>We have received your <strong>${documentType}</strong> documents.</p>
    <p>Our team will review them and contact you if any additional information is needed.</p>
  </body></html>`;
  const text = `Hello ${patientName},\n\nWe have received your ${documentType} documents.\n\nOur team will review them and contact you if any additional information is needed.`;
  return { html, text, subject };
}
```

**Step 6: Generic notification template**
```typescript
// workers/src/platform/email/templates/notification.ts
export function renderNotification(patientName: string, message: string): { html: string; text: string; subject: string } {
  const subject = "AG Synergy — Notification";
  const html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Notification</h1>
    <p>Hello ${patientName},</p>
    <p>${message}</p>
  </body></html>`;
  const text = `Hello ${patientName},\n\n${message}`;
  return { html, text, subject };
}
```

**Step 7: Typecheck**
Run: `npx tsc --noEmit -p workers/tsconfig.json 2>&1 | tail -5`

**Step 8: Commit**
```bash
git add workers/src/platform/email/templates/
git commit -m "feat(email): add email templates for all journey steps"
```

---

### Task 5: Create Email Template Registry
**Objective:** Create a registry that maps template names to their renderers.

**Files:**
- Create: `workers/src/platform/email/template-registry.ts`

**Step 1: Implement the registry**
```typescript
import { renderVerificationEmail } from "./templates/verification.js";
import { renderPasswordResetEmail } from "./templates/password-reset.js";
import { renderConsultationConfirmation } from "./templates/consultation-confirmation.js";
import { renderAppointmentConfirmation } from "./templates/appointment-confirmation.js";
import { renderDocumentUploadConfirmation } from "./templates/document-upload.js";
import { renderNotification } from "./templates/notification.js";

export type TemplateName = "verification" | "password-reset" | "consultation-confirmation" | "appointment-confirmation" | "document-upload" | "notification";

export interface TemplateContext {
  verificationUrl?: string;
  resetUrl?: string;
  patientName: string;
  date?: string;
  time?: string;
  doctor?: string;
  type?: string;
  documentType?: string;
  message?: string;
  [key: string]: string | undefined;
}

export function renderTemplate(name: TemplateName, ctx: TemplateContext): { html: string; text: string; subject: string } {
  switch (name) {
    case "verification":
      return renderVerificationEmail(ctx.verificationUrl || "", ctx.patientName);
    case "password-reset":
      return renderPasswordResetEmail(ctx.resetUrl || "", ctx.patientName);
    case "consultation-confirmation":
      return renderConsultationConfirmation({ date: ctx.date || "", time: ctx.time || "", doctor: ctx.doctor || "", patientName: ctx.patientName });
    case "appointment-confirmation":
      return renderAppointmentConfirmation({ date: ctx.date || "", time: ctx.time || "", type: ctx.type || "", patientName: ctx.patientName });
    case "document-upload":
      return renderDocumentUploadConfirmation(ctx.patientName, ctx.documentType || "medical");
    case "notification":
      return renderNotification(ctx.patientName, ctx.message || "");
    default:
      throw new Error(`Unknown template: ${name}`);
  }
}
```

**Step 2: Typecheck**
Run: `npx tsc --noEmit -p workers/tsconfig.json 2>&1 | tail -5`

**Step 3: Commit**
```bash
git add workers/src/platform/email/template-registry.ts
git commit -m "feat(email): add template registry"
```

---

### Task 6: Wire EmailService into Identity Routes
**Objective:** Integrate EmailService into the identity routes so verification emails are actually sent.

**Files:**
- Modify: `workers/src/platform/identity/routes/identity-routes.ts`
- Modify: `workers/src/platform/identity/identity-service.ts`

**Step 1: Update identity-routes.ts to use EmailService**
In the handleEmailVerification method, after storing the token in D1, call emailService.sendEmail() with the verification URL.

**Step 2: Update identity-service.ts to accept EmailService**
Add emailService as a constructor dependency. Pass it through from the route handler.

**Step 3: Typecheck**
Run: `npx tsc --noEmit -p workers/tsconfig.json 2>&1 | tail -5`

**Step 4: Commit**
```bash
git add workers/src/platform/identity/routes/identity-routes.ts workers/src/platform/identity/identity-service.ts
git commit -m "feat(email): wire EmailService into identity routes"
```

---

### Task 7: Add Worker Secrets for Resend
**Objective:** Configure the Resend API key as a Worker Secret.

**Files:**
- Modify: `workers/wrangler.jsonc`

**Step 1: Add Resend secret binding**
Add `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS` to the secrets configuration in wrangler.jsonc.

**Step 2: Commit**
```bash
git add workers/wrangler.jsonc
git commit -m "feat(email): add Resend secret bindings to wrangler config"
```

---

### Task 8: Add Email Health Endpoint to EPCL
**Objective:** Expose email provider health status via the EPCL health endpoint.

**Files:**
- Modify: `workers/src/routes/epcl.ts`

**Step 1: Add email health check**
In the EPCL health endpoint, include email provider status.

**Step 2: Typecheck**
Run: `npx tsc --noEmit -p workers/tsconfig.json 2>&1 | tail -5`

**Step 3: Commit**
```bash
git add workers/src/routes/epcl.ts
git commit -m "feat(email): add email provider health to EPCL endpoint"
```

---

### Task 9: Write Unit Tests
**Objective:** Write unit tests for EmailProvider, ResendProvider, EmailService, and templates.

**Files:**
- Create: `workers/tests/email/email-provider.test.ts`
- Create: `workers/tests/email/resend-provider.test.ts`
- Create: `workers/tests/email/email-service.test.ts`
- Create: `workers/tests/email/templates.test.ts`

**Step 1: Write tests for each module**

**Step 2: Run tests**
Run: `npx vitest run workers/tests/email/ -v`
Expected: All tests pass

**Step 3: Commit**
```bash
git add workers/tests/email/
git commit -m "test(email): add unit tests for email provider, service, and templates"
```

---

### Task 10: Typecheck and Full Suite
**Objective:** Ensure no type errors or regressions.

**Step 1: Run typecheck**
Run: `npx tsc --noEmit -p workers/tsconfig.json 2>&1 | tail -10`

**Step 2: Run full test suite**
Run: `npx vitest run 2>&1 | tail -20`

**Step 3: Commit**
```bash
git add -A
git commit -m "chore(email): typecheck and test suite passing"
```

---

### Task 11: Deploy to Preview
**Objective:** Deploy the email infrastructure to the preview environment.

**Step 1: Deploy**
Run: `npx wrangler deploy --env preview`

**Step 2: Verify deployment**
Run: `curl -s https://preview-api.agsynergy.ca/api/v1/epcl/health | jq .`

**Step 3: Commit**
```bash
git commit -m "chore: deploy email infrastructure to preview"
```

---

### Task 12: Integration Test — Full Patient Journey
**Objective:** Execute the complete golden path against preview with email delivery working.

**Step 1: Register a new patient**
**Step 2: Verify email is delivered (check Resend dashboard or logs)**
**Step 3: Complete email verification**
**Step 4: Login**
**Step 5: Complete profile**
**Step 6: Upload documents**
**Step 7: Book consultation**
**Step 8: View appointments**
**Step 9: View IVF timeline**
**Step 10: Manage consent**
**Step 11: Logout**
**Step 12: Login again**
**Step 13: Resume journey**

**Step 14: Document results**

---

### Task 13: Deploy to Production
**Objective:** Deploy the email infrastructure to production.

**Step 1: Deploy**
Run: `npx wrangler deploy --env production`

**Step 2: Verify production health**
Run: `curl -s https://api.agsynergy.ca/api/v1/epcl/health | jq .`

**Step 3: Commit**
```bash
git commit -m "chore: deploy email infrastructure to production"
```

---

### Task 14: Production Validation — Full Patient Journey
**Objective:** Execute the complete golden path against production with real email delivery.

**Step 1: Register a new patient with real @agsynergy.ca email**
**Step 2: Verify email is delivered**
**Step 3: Complete email verification**
**Step 4: Login**
**Step 5: Complete full authenticated journey**
**Step 6: Document results**

---

### Task 15: Final Report and Pilot Decision
**Objective:** Produce the final executive report and pilot readiness decision.

**Deliverables:**
- Executive Summary
- Journey Score
- Completed Steps
- Failed Steps
- Evidence
- Files Changed
- Tests Added
- Deployment Status
- Remaining Blockers
- Pilot Decision (GREEN / YELLOW / RED)

---

## Files Likely to Change

| File | Action |
|---|---|
| `workers/src/platform/email/email-provider.ts` | Create |
| `workers/src/platform/email/resend-provider.ts` | Create |
| `workers/src/platform/email/email-service.ts` | Create |
| `workers/src/platform/email/template-registry.ts` | Create |
| `workers/src/platform/email/templates/verification.ts` | Create |
| `workers/src/platform/email/templates/password-reset.ts` | Create |
| `workers/src/platform/email/templates/consultation-confirmation.ts` | Create |
| `workers/src/platform/email/templates/appointment-confirmation.ts` | Create |
| `workers/src/platform/email/templates/document-upload.ts` | Create |
| `workers/src/platform/email/templates/notification.ts` | Create |
| `workers/src/platform/identity/routes/identity-routes.ts` | Modify |
| `workers/src/platform/identity/identity-service.ts` | Modify |
| `workers/src/routes/epcl.ts` | Modify |
| `workers/wrangler.jsonc` | Modify |
| `workers/tests/email/` | Create |
| `docs/context/CURRENT_WORK.yaml` | Modify |
| `docs/context/KNOWN_GAPS.yaml` | Modify |
| `docs/context/DECISION_LOG.md` | Modify |

## Risks & Tradeoffs

- **Resend API key in secrets:** Must be configured in Cloudflare Workers Secrets, never committed
- **Email deliverability:** SPF/DKIM/DMARC must be configured for `agsynergy.ca` domain
- **Template rendering:** No frontend framework; using plain HTML strings — maintainable but limited
- **Rate limiting:** Resend has rate limits; need retry with backoff for burst scenarios
- **Cost:** Resend has a free tier (3,000 emails/month); pilot validation should stay within limits

## Verification Steps

1. `npx tsc --noEmit -p workers/tsconfig.json` — zero errors
2. `npx vitest run workers/tests/email/ -v` — all pass
3. `npx vitest run` — full suite passes, zero regressions
4. `curl -s https://api.agsynergy.ca/api/v1/epcl/health` — email provider health included
5. Full golden path probe against production — all 15 steps pass
