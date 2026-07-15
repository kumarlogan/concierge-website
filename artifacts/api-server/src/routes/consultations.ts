/**
 * @file consultations.ts
 * @description API routes for consultation request submissions.
 * @extensionPoint Add webhook delivery (e.g. to HubSpot, Pipedrive, or a Telegram notification)
 *   by calling a webhook after db.insert() succeeds. Add email confirmation by integrating
 *   an SMTP/transactional email provider in the onSuccess block.
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { consultationRequestsTable } from "@workspace/db";
import { SubmitConsultationBody } from "@workspace/api-zod";
import { count } from "drizzle-orm";

const router: IRouter = Router();

/**
 * POST /api/consultations
 * Submit a new consultation enquiry.
 */
router.post("/consultations", async (req, res) => {
  const parseResult = SubmitConsultationBody.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const data = parseResult.data;

  try {
    const [inserted] = await db
      .insert(consultationRequestsTable)
      .values({
        name: data.name,
        partnerName: data.partnerName ?? null,
        email: data.email,
        phone: data.phone ?? null,
        province: data.province,
        treatmentInterest: data.treatmentInterest,
        howDidYouHear: data.howDidYouHear ?? null,
        message: data.message,
        consentToContact: data.consentToContact ?? false,
      })
      .returning();

    req.log.info({ id: inserted.id, email: inserted.email }, "Consultation request submitted");

    res.status(201).json({
      id: inserted.id,
      message: `Thank you, ${data.name}. We've received your enquiry and will be in touch within one business day.`,
      submittedAt: inserted.submittedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to insert consultation request");
    res.status(500).json({ error: "Something went wrong. Please try again or contact us directly." });
  }
});

/**
 * GET /api/consultations/count
 * Returns the total number of consultation requests.
 * Used by the frontend to show social proof ("X families helped").
 */
router.get("/consultations/count", async (req, res) => {
  try {
    const [{ value }] = await db
      .select({ value: count() })
      .from(consultationRequestsTable);

    res.json({ count: value });
  } catch (err) {
    req.log.error({ err }, "Failed to count consultation requests");
    res.status(500).json({ error: "Failed to retrieve count." });
  }
});

export default router;
