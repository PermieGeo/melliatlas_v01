// Feature IDs: SOURCES.PROVIDER_CONFIGURATION, NOTICES.EXTRACTION
import { z } from "zod";
import {
  SATURN_MAX_LATITUDE,
  SATURN_MAX_LONGITUDE,
  SATURN_MIN_LATITUDE,
  SATURN_MIN_LINEAR_RING_POSITIONS,
  SATURN_MIN_LONGITUDE,
  SATURN_MIN_MULTIPOLYGON_POLYGONS,
  SATURN_MIN_POLYGON_RINGS,
} from "./providers/saturn/sourceProfile.js";

// This legacy treatment-page adapter uses Saturn's observed provider shape.
// Its page budget is independent of viewport-index pagination and public map limits.
const MAX_TREATMENT_PAGE_RECORDS = 200;
const MAX_UNIX_SECONDS = 253_402_300_799; // 9999-12-31T23:59:59Z.
const MILLISECONDS_PER_SECOND = 1_000;
const UNIX_SECONDS_PATTERN = /^\d{1,12}$/;

/** Provider hazard-class codes, not an independently verified risk assessment. */
enum BeeHazardClass {
  One = 1,
  Two = 2,
  Three = 3,
}

enum GeoJsonGeometryType {
  Polygon = "Polygon",
  MultiPolygon = "MultiPolygon",
}

/** GeoJSON positions use WGS84 degrees in [longitude, latitude] order. */
const coordinate = z.tuple([
  z.number().finite().min(SATURN_MIN_LONGITUDE).max(SATURN_MAX_LONGITUDE),
  z.number().finite().min(SATURN_MIN_LATITUDE).max(SATURN_MAX_LATITUDE),
]);

// A linear ring needs at least four positions (including its closing point).
// This permissive evidence parser does not enforce closure, winding or topology;
// treatment ingestion checks spatial validity in PostGIS before map projection.
const ring = z.array(coordinate).min(SATURN_MIN_LINEAR_RING_POSITIONS);
const polygon = z
  .object({
    type: z.literal(GeoJsonGeometryType.Polygon),
    // The first ring is the exterior; subsequent rings can describe holes.
    coordinates: z.array(ring).min(SATURN_MIN_POLYGON_RINGS),
  })
  .passthrough();
const multiPolygon = z
  .object({
    type: z.literal(GeoJsonGeometryType.MultiPolygon),
    // Each polygon has its own exterior and optional interior rings.
    coordinates: z
      .array(z.array(ring).min(SATURN_MIN_POLYGON_RINGS))
      .min(SATURN_MIN_MULTIPOLYGON_POLYGONS),
  })
  .passthrough();
const geometrySchema = z.discriminatedUnion("type", [polygon, multiPolygon]);

// Nullable and inconsistently typed optional provider fields must not reject an otherwise valid page.
// Validate the page/record envelopes; interpret optional claims independently without inventing values.
const pageSchema = z
  .object({
    content: z
      .array(z.object({}).passthrough())
      .max(MAX_TREATMENT_PAGE_RECORDS),
    totalElements: z.number().int().nonnegative().nullish(),
    number: z.number().int().nonnegative().nullish(),
    size: z.number().int().positive().max(MAX_TREATMENT_PAGE_RECORDS).nullish(),
    numberOfElements: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_TREATMENT_PAGE_RECORDS)
      .nullish(),
    totalPages: z.number().int().nonnegative().nullish(),
    last: z.boolean().nullish(),
    pageable: z
      .object({
        pageNumber: z.number().int().nonnegative().nullish(),
        pageSize: z
          .number()
          .int()
          .positive()
          .max(MAX_TREATMENT_PAGE_RECORDS)
          .nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough()
  .superRefine((page, ctx) => {
    // Spring pages may report position and size both at the root and under pageable.
    // Disagreement cannot be safely resolved by choosing one representation.
    if (
      page.number != null &&
      page.pageable?.pageNumber != null &&
      page.number !== page.pageable.pageNumber
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pageable", "pageNumber"],
        message: "Conflicting page numbers",
      });
    }
    if (
      page.size != null &&
      page.pageable?.pageSize != null &&
      page.size !== page.pageable.pageSize
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pageable", "pageSize"],
        message: "Conflicting page sizes",
      });
    }
  });

/** Provider-reported page metadata is optional but must be consistent when present. */
export type TreatmentPageMetadata = {
  number: number | null;
  size: number | null;
  numberOfElements: number | null;
  totalPages: number | null;
  last: boolean | null;
};

export type BeekeeperPlan = {
  /** Source field/acreage record ID, never the potentially shared plan ID. */
  externalId: string | null;
  planId: string | null;
  isUpdated: boolean | null;
  contractorName: string | null;
  cadastralNumber: string | null;
  startAt: string | null;
  endAt: string | null;
  /** Source-reported publication time, distinct from retrieval and treatment dates. */
  publishedAt: string | null;
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
    typeof value === "string" && UNIX_SECONDS_PATTERN.test(value)
      ? Number(value)
      : value;
  if (
    typeof number !== "number" ||
    !Number.isSafeInteger(number) ||
    number <= 0 ||
    number > MAX_UNIX_SECONDS
  )
    return null;
  const date = new Date(number * MILLISECONDS_PER_SECOND);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function beeHazardClass(value: unknown): number | null {
  const number =
    typeof value === "string" && /^[1-3]$/.test(value) ? Number(value) : value;
  return number === BeeHazardClass.One ||
    number === BeeHazardClass.Two ||
    number === BeeHazardClass.Three
    ? number
    : null;
}

/**
 * Parse an unreviewed Saturn treatment page without inferring missing claims.
 * A plan may cover multiple fields: beeAcreage.id identifies the observation,
 * while beeAcreage.planId groups related fields and must not deduplicate them.
 * Revised dates are authoritative for isUpdated=true; missing revised values
 * stay unknown instead of mixing two versions of the same schedule.
 */
export function parseBeekeeperPlanPage(input: unknown): {
  totalElements: number | null;
  pagination: TreatmentPageMetadata;
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
    pagination: {
      number: page.number ?? page.pageable?.pageNumber ?? null,
      size: page.size ?? page.pageable?.pageSize ?? null,
      numberOfElements: page.numberOfElements ?? null,
      totalPages: page.totalPages ?? null,
      last: page.last ?? null,
    },
    plans: page.content.map((record) => {
      const acreage = objectOrNull(record.beeAcreage);
      const parsedGeometry = geometrySchema.safeParse(acreage?.geo);
      const isUpdated =
        typeof acreage?.isUpdated === "boolean" ? acreage.isUpdated : null;
      const startDate =
        isUpdated === true ? acreage?.planDateUpdate : acreage?.planDate;
      const endDate =
        isUpdated === true ? acreage?.planDateEndUpdate : acreage?.planDateEnd;
      // In the supplied offline sample allPatList already contains the effective
      // products (patIdsUpdate for revisions, patIds otherwise). Do not merge
      // both lists or synthesize product claims from the ID strings.
      const products = Array.isArray(record.allPatList)
        ? record.allPatList
        : [];
      return {
        externalId: optionalId(acreage?.id),
        planId: optionalId(acreage?.planId),
        isUpdated,
        contractorName: optionalText(acreage?.contractorName),
        cadastralNumber: optionalText(acreage?.cadNum),
        startAt: unixSeconds(startDate),
        endAt: unixSeconds(endDate),
        publishedAt: unixSeconds(acreage?.datePublishing),
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
