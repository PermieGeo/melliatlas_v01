// Feature IDs: SOURCES.DOCUMENT_HISTORY, SOURCES.PROVIDER_CONFIGURATION, NOTICES.MAP_OVERLAY
import { z } from "zod";

export const coordinatesSchema = z
  .object({
    lat: z.number().finite().min(-90).max(90),
    lon: z.number().finite().min(-180).max(180),
  })
  .strict();

export const locationQuerySchema = z
  .object({
    lat: z.coerce.number().finite().min(-90).max(90),
    lon: z.coerce.number().finite().min(-180).max(180),
  })
  .strict();

export const provenanceSchema = z
  .object({
    sourceId: z.string().min(1),
    sourceName: z.string().min(1),
    sourceUrl: z.string().url(),
    retrievedAt: z.string().datetime(),
    observedAt: z.string().datetime(),
    nature: z.enum(["forecast_model", "observation", "published_notice"]),
  })
  .strict();

export const currentWeatherSchema = z
  .object({
    temperatureC: z.number().finite(),
    relativeHumidityPct: z.number().finite().min(0).max(100),
    windSpeedMs: z.number().finite().nonnegative(),
    windDirectionDeg: z.number().finite().min(0).max(360),
    precipitationMm: z.number().finite().nonnegative(),
  })
  .strict();

export const inspectionResponseSchema = z
  .object({
    point: coordinatesSchema,
    weather: currentWeatherSchema,
    provenance: provenanceSchema,
  })
  .strict();

export const sourceCatalogEntrySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: z.enum([
      "weather",
      "basemap",
      "municipal_notice",
      "treatment",
      "imagery",
    ]),
    lifecycle: z.enum(["configured", "disabled", "under_review"]),
    url: z.string().url(),
    termsReview: z.enum(["pending", "reviewed"]),
    lastSuccessfulIngestAt: z.string().datetime().nullable(),
  })
  .strict();

export const sourceCatalogResponseSchema = z
  .object({
    sources: z.array(sourceCatalogEntrySchema),
  })
  .strict();

export const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        requestId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type Coordinates = z.infer<typeof coordinatesSchema>;
export type InspectionResponse = z.infer<typeof inspectionResponseSchema>;
export type SourceCatalogEntry = z.infer<typeof sourceCatalogEntrySchema>;
export type SourceCatalogResponse = z.infer<typeof sourceCatalogResponseSchema>;

// Feature IDs: SOURCES.PROVIDER_CONFIGURATION
const providerParameterNameSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/)
  .refine(
    (key) => !["__proto__", "constructor", "prototype"].includes(key),
    "Unsafe parameter name",
  );

const providerParameterValueSchema = z.unknown().superRefine((value, ctx) => {
  let visited = 0;
  const check = (item: unknown, depth: number): boolean => {
    visited += 1;
    if (visited > 100 || depth > 5) return false;
    if (typeof item === "string") return item.length <= 1000;
    if (typeof item === "number") return Number.isSafeInteger(item);
    if (typeof item === "boolean" || item === null) return true;
    if (Array.isArray(item))
      return item.length <= 30 && item.every((part) => check(part, depth + 1));
    if (item && typeof item === "object") {
      const entries = Object.entries(item);
      return (
        entries.length <= 30 &&
        entries.every(
          ([key, part]) =>
            providerParameterNameSchema.safeParse(key).success &&
            !["constructor", "prototype", "__proto__"].includes(key) &&
            check(part, depth + 1),
        )
      );
    }
    return false;
  };
  if (!check(value, 0))
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid or oversized JSON parameter",
    });
});

export const providerRequestSettingsSchema = z
  .object({
    method: z.enum(["GET", "POST"]),
    regionParameter: providerParameterNameSchema,
    regionContainer: providerParameterNameSchema.optional(),
    regionCode: z.number().int().min(1).max(999999),
    parameters: z
      .record(providerParameterNameSchema, providerParameterValueSchema)
      .refine(
        (value) => Object.keys(value).length <= 20,
        "Too many parameters",
      ),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      Object.hasOwn(
        value.parameters,
        value.regionContainer ?? value.regionParameter,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Region field/container cannot be overridden",
      });
    }
  });

export const providerConfigurationEditSchema = z
  .object({
    providerName: z.string().trim().min(1).max(200),
    endpoint: z.string().min(1).max(2048),
    request: providerRequestSettingsSchema,
    expectedRevision: z.string().regex(/^[1-9][0-9]{0,17}$/),
  })
  .strict();

export const providerConfigurationSchema = z
  .object({
    providerName: z.string().min(1).max(200),
    endpoint: z.string(),
    request: providerRequestSettingsSchema,
    revision: z.string().regex(/^[1-9][0-9]{0,17}$/),
    collectionEnabled: z.literal(false),
  })
  .strict();

export type ProviderConfiguration = z.infer<typeof providerConfigurationSchema>;
export type ProviderConfigurationEdit = z.infer<
  typeof providerConfigurationEditSchema
>;
export type ProviderRequestSettings = z.infer<
  typeof providerRequestSettingsSchema
>;

// Feature IDs: NOTICES.MAP_OVERLAY
export const treatmentGeometrySchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("Polygon"),
      coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
    })
    .strict(),
  z
    .object({
      type: z.literal("MultiPolygon"),
      coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()])))),
    })
    .strict(),
]);

export const mapTreatmentSchema = z
  .object({
    id: z.string().uuid(),
    sourceName: z.string().min(1),
    sourceUrl: z.string().url(),
    retrievedAt: z.string().datetime(),
    publishedAt: z.string().datetime().nullable(),
    startAt: z.string().datetime().nullable(),
    endAt: z.string().datetime().nullable(),
    contractorName: z.string().nullable(),
    cadastralNumber: z.string().nullable(),
    treatments: z.array(
      z
        .object({
          name: z.string().nullable(),
          crop: z.string().nullable(),
          beeHazardClass: z.number().int().min(1).max(3).nullable(),
        })
        .strict(),
    ),
    geometry: treatmentGeometrySchema,
    spatialPrecision: z.literal("exact_polygon"),
    reviewStatus: z.enum(["pending", "verified"]).optional(),
  })
  .strict();
export const mapTreatmentsResponseSchema = z
  .object({ notices: z.array(mapTreatmentSchema) })
  .strict();
export type MapTreatment = z.infer<typeof mapTreatmentSchema>;

// Feature IDs: SOURCES.PROVIDER_CONFIGURATION, NOTICES.MAP_OVERLAY
export const providerCollectionStatusSchema = z
  .object({
    sourceConfigured: z.boolean(),
    latestRun: z
      .object({
        status: z.enum(["started", "succeeded", "failed", "partial"]),
        startedAt: z.string().datetime(),
        completedAt: z.string().datetime().nullable(),
        received: z.number().int().nonnegative(),
        accepted: z.number().int().nonnegative(),
        errorCode: z.string().nullable(),
      })
      .strict()
      .nullable(),
    pendingReview: z.number().int().nonnegative(),
    pendingWithGeometry: z.number().int().nonnegative(),
    verifiedWithGeometry: z.number().int().nonnegative(),
    missingGeometry: z.number().int().nonnegative(),
  })
  .strict();

export type ProviderCollectionStatus = z.infer<
  typeof providerCollectionStatusSchema
>;

// Feature IDs: SOURCES.DOCUMENT_HISTORY
export const districtCacheEntrySchema = z
  .object({
    sourceId: z.string(),
    revision: z.string(),
    districtId: z.number().int().positive(),
    filterHash: z.string().regex(/^[a-f0-9]{64}$/),
    state: z.enum(["running", "paused", "completed", "failed"]),
    nextPage: z.number().int().nonnegative(),
    pagesFetched: z.number().int().nonnegative(),
    recordsReceived: z.number().int().nonnegative(),
    recordsStored: z.number().int().nonnegative(),
    totalElements: z.number().int().nonnegative().nullable(),
    completedAt: z.string().datetime().nullable(),
    expiresAt: z.string().datetime().nullable(),
    lastErrorCode: z.string().nullable(),
    coverage: z.enum(["fresh", "stale", "partial", "unknown"]),
  })
  .strict();
export const districtCacheStatusSchema = z
  .object({
    ttlHours: z.literal(24),
    refreshEnabled: z.literal(false),
    entries: z.array(districtCacheEntrySchema),
  })
  .strict();
export type DistrictCacheStatus = z.infer<typeof districtCacheStatusSchema>;

export const regionalScanStatusSchema = z
  .object({
    regionCode: z.number().int().positive().nullable(),
    nextPage: z.number().int().nonnegative(),
    scan: z
      .object({
        state: z.enum(["running", "paused", "completed"]),
        revision: z.string(),
        regionCode: z.number().int().positive(),
        scheduledOn: z.string().nullable(),
        startedAt: z.string().datetime(),
        completedAt: z.string().datetime().nullable(),
        nextAllowedAt: z.string().datetime(),
        pagesFetched: z.number().int().nonnegative(),
        recordsReceived: z.number().int().nonnegative(),
        recordsStored: z.number().int().nonnegative(),
        totalElements: z.number().int().nonnegative().nullable(),
        errorCode: z.string().nullable(),
        consecutiveErrors: z.number().int().nonnegative(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type RegionalScanStatus = z.infer<typeof regionalScanStatusSchema>;

export { helpDocumentSchema } from "./helpContent.js";
export type { HelpDocument, HelpSection } from "./helpContent.js";

export {
  viewportCollectionSelectionSchema,
  viewportCollectionResultSchema,
} from "./viewportCollection.js";
export type {
  ViewportCollectionSelection,
  ViewportCollectionResult,
} from "./viewportCollection.js";
