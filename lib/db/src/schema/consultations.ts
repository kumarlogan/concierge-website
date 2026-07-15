import { pgTable, serial, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const treatmentInterestEnum = pgEnum("treatment_interest", [
  "IVF",
  "ICSI",
  "Egg Freezing",
  "Embryo Freezing",
  "Donor Programs",
  "Fertility Preservation",
  "Not Sure Yet",
]);

export const consultationRequestsTable = pgTable("consultation_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  partnerName: text("partner_name"),
  email: text("email").notNull(),
  phone: text("phone"),
  province: text("province").notNull(),
  treatmentInterest: treatmentInterestEnum("treatment_interest").notNull(),
  howDidYouHear: text("how_did_you_hear"),
  message: text("message").notNull(),
  consentToContact: boolean("consent_to_contact").default(false),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  status: text("status").default("new").notNull(), // new | reviewed | contacted
});

export const insertConsultationSchema = createInsertSchema(consultationRequestsTable).omit({
  id: true,
  submittedAt: true,
  status: true,
});

export type InsertConsultation = z.infer<typeof insertConsultationSchema>;
export type ConsultationRequest = typeof consultationRequestsTable.$inferSelect;
