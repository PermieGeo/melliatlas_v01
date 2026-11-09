// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { z } from "zod";

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
    patAllList: z.array(productSchema).max(500).nullish(),
    // Updated product entries have not been observed with nonempty content.
    patUpdateAllList: z.array(z.unknown()).max(500).nullish(),
    datePublishing: z.number().int().nonnegative().safe().nullish(),
  })
  .passthrough();

export type SaturnAcrEvidence = {
  responseId: string;
  reportedPlanInterval: "missing" | "partial" | "ordered" | "reversed";
  reportedProductCount: number | null;
  reportedUpdatedProductCount: number | null;
  publishingTimestampPresent: boolean;
};

/**
 * Summarize selected observed ACR fields for offline research only.
 * The result deliberately omits names, chemicals, dosage, coordinates and dates.
 * Neither a valid response nor an ID overlap establishes a treatment or polygon join.
 */
export function inspectSaturnAcrEvidence(input: unknown): SaturnAcrEvidence {
  const detail = acrEvidenceSchema.parse(input);
  const start = detail.startPlanDate;
  const finish = detail.finishPlanDate;
  const reportedPlanInterval =
    !start && !finish
      ? "missing"
      : !start || !finish
        ? "partial"
        : Date.parse(start) <= Date.parse(finish)
          ? "ordered"
          : "reversed";

  return {
    responseId: String(detail.id),
    reportedPlanInterval,
    reportedProductCount: detail.patAllList?.length ?? null,
    reportedUpdatedProductCount: detail.patUpdateAllList?.length ?? null,
    publishingTimestampPresent: detail.datePublishing != null,
  };
}
