// Feature IDs: SOURCES.PROVIDER_CONFIGURATION, NOTICES.EXTRACTION
import { z } from "zod";

const coordinate = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const polygon = z
  .object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(coordinate).min(4)).min(1),
  })
  .passthrough();
const multiPolygon = z
  .object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(z.array(coordinate).min(4)).min(1)).min(1),
  })
  .passthrough();

// Nullable and inconsistently typed optional provider fields must not reject an otherwise valid page.
// Validate the page/record envelopes; interpret optional claims independently without inventing values.
const pageSchema = z
  .object({
    content: z.array(z.object({}).passthrough()).max(200),
    totalElements: z.number().int().nonnegative().nullish(),
  })
  .passthrough();

export type BeekeeperPlan = {
  externalId: string | null;
  contractorName: string | null;
  cadastralNumber: string | null;
  startAt: string | null;
  endAt: string | null;
  geometry: z.infer<typeof polygon> | z.infer<typeof multiPolygon> | null;
  treatments: {
    name: string | null;
    crop: string | null;
    beeHazardClass: number | null;
  }[];
};

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function optionalId(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  return typeof value === "number" && Number.isSafeInteger(value)
    ? String(value)
    : null;
}

function unixSeconds(value: unknown): string | null {
  const number =
    typeof value === "string" && /^\d{1,12}$/.test(value)
      ? Number(value)
      : value;
  if (
    typeof number !== "number" ||
    !Number.isSafeInteger(number) ||
    number <= 0 ||
    number > 253402300799
  )
    return null;
  const date = new Date(number * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function beeHazardClass(value: unknown): number | null {
  const number =
    typeof value === "string" && /^[1-3]$/.test(value) ? Number(value) : value;
  return number === 1 || number === 2 || number === 3 ? number : null;
}

/** Parse a provider page as unreviewed evidence; unknown optional values remain unknown. */
export function parseBeekeeperPlanPage(input: unknown): {
  totalElements: number | null;
  plans: BeekeeperPlan[];
} {
  const page = pageSchema.parse(input);
  // Viewport search returns parcel centers, not treatment evidence or field polygons.
  if (
    page.content.some(
      (record) =>
        record.beeAcreage == null &&
        typeof record.planId === "number" &&
        typeof record.centerX === "number" &&
        typeof record.centerY === "number",
    )
  ) {
    throw new Error(
      "Saturn map-query summaries cannot be ingested as treatment plans",
    );
  }
  return {
    totalElements: page.totalElements ?? null,
    plans: page.content.map((record) => {
      const acreage = objectOrNull(record.beeAcreage);
      const parsedGeometry = z
        .union([polygon, multiPolygon])
        .safeParse(acreage?.geo);
      const products = Array.isArray(record.allPatList)
        ? record.allPatList
        : [];
      return {
        externalId:
          optionalId(acreage?.planId) ??
          optionalId(acreage?.id) ??
          optionalId(record.id),
        contractorName: optionalText(acreage?.contractorName),
        cadastralNumber: optionalText(acreage?.cadNum),
        startAt: unixSeconds(acreage?.planDate),
        endAt: unixSeconds(acreage?.planDateEnd),
        geometry: parsedGeometry.success ? parsedGeometry.data : null,
        treatments: products.flatMap((rawProduct: unknown) => {
          const product = objectOrNull(rawProduct);
          if (!product) return [];
          return [
            {
              name: optionalText(product.patName),
              crop: optionalText(product.regulationCropName),
              beeHazardClass: beeHazardClass(product.patProductDangerClassBee),
            },
          ];
        }),
      };
    }),
  };
}
