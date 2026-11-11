// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { z } from "zod";
import { SATURN_MAX_ACR_PRODUCTS } from "./sourceProfile.js";

enum SaturnReportedPlanInterval {
  Missing = "missing",
  Partial = "partial",
  Ordered = "ordered",
  Reversed = "reversed",
}

const utcTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/)
  .refine((value) => {
    const parsed = new Date(value);
    return (
      !Number.isNaN(parsed.getTime()) &&
      (parsed.toISOString() === value ||
        parsed.toISOString().replace(".000Z", "Z") === value)
    );
  });
const productSchema = z
  .object({
    id: z.number().int().positive().safe(),
    patProductDangerClassBee: z.number().int().nonnegative().safe().nullish(),
    patProductDangerClassMan: z.number().int().nonnegative().safe().nullish(),
  })
  .passthrough();
const acrEvidenceSchema = z
  .object({
    id: z.number().int().positive().safe(),
    startPlanDate: utcTimestampSchema.nullish(),
    finishPlanDate: utcTimestampSchema.nullish(),
    patAllList: z.array(productSchema).max(SATURN_MAX_ACR_PRODUCTS).nullish(),
    // Updated product entries have not been observed with nonempty content.
    patUpdateAllList: z
      .array(z.unknown())
      .max(SATURN_MAX_ACR_PRODUCTS)
      .nullish(),
    datePublishing: z.number().int().nonnegative().safe().nullish(),
  })
  .passthrough();

export type SaturnAcrEvidence = {
  responseId: string;
  reportedPlanInterval: `${SaturnReportedPlanInterval}`;
  reportedProductCount: number | null;
  reportedUpdatedProductCount: number | null;
  publishingTimestampPresent: boolean;
};

/**
 * Summarize selected observed ACR fields for offline research only.
 * The result deliberately omits names, chemicals, dosage, coordinates and dates.
 * Neither a valid response nor an ID overlap establishes a treatment or polygon join.
 */
function reportedPlanInterval(
  start: string | null | undefined,
  finish: string | null | undefined,
): SaturnReportedPlanInterval {
  if (!start && !finish) return SaturnReportedPlanInterval.Missing;
  if (!start || !finish) return SaturnReportedPlanInterval.Partial;
  return Date.parse(start) <= Date.parse(finish)
    ? SaturnReportedPlanInterval.Ordered
    : SaturnReportedPlanInterval.Reversed;
}

export function inspectSaturnAcrEvidence(input: unknown): SaturnAcrEvidence {
  const detail = acrEvidenceSchema.parse(input);

  return {
    responseId: String(detail.id),
    reportedPlanInterval: reportedPlanInterval(
      detail.startPlanDate,
      detail.finishPlanDate,
    ),
    reportedProductCount: detail.patAllList?.length ?? null,
    reportedUpdatedProductCount: detail.patUpdateAllList?.length ?? null,
    publishingTimestampPresent: detail.datePublishing != null,
  };
}
