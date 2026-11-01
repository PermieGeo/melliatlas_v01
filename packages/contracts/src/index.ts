// Feature IDs: SOURCES.SATURN_CONFIGURATION
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

// Feature IDs: SOURCES.SATURN_CONFIGURATION
const saturnParameterNameSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/);

export const saturnRequestSettingsSchema = z
  .object({
    method: z.enum(["GET", "POST"]),
    regionParameter: saturnParameterNameSchema,
    regionCode: z.number().int().min(1).max(9999),
    parameters: z
      .record(
        z.union([
          z.string().max(200),
          z.number().int().safe(),
          z.boolean(),
        ]),
      )
      .refine((value) => Object.keys(value).length <= 20, "Too many parameters")
      .refine(
        (value) =>
          Object.keys(value).every((key) =>
            saturnParameterNameSchema.safeParse(key).success,
          ),
        "Invalid parameter name",
      ),
  })
  .strict()
  .refine(
    (value) => !Object.hasOwn(value.parameters, value.regionParameter),
    "Region parameter must not be overridden",
  );

export const saturnConfigurationEditSchema = z
  .object({
    endpoint: z.string().min(1).max(2048),
    request: saturnRequestSettingsSchema,
    expectedRevision: z.string().regex(/^[1-9][0-9]{0,17}$/),
  })
  .strict();

export const saturnConfigurationSchema = z
  .object({
    endpoint: z.string().min(1),
    request: saturnRequestSettingsSchema,
    revision: z.string().regex(/^[1-9][0-9]{0,17}$/),
    accessDecision: z.enum(["pending", "approved", "denied"]),
    collectionEnabled: z.literal(false),
  })
  .strict();

export type SaturnConfiguration = z.infer<typeof saturnConfigurationSchema>;
export type SaturnConfigurationEdit = z.infer<
  typeof saturnConfigurationEditSchema
>;
export type SaturnRequestSettings = z.infer<
  typeof saturnRequestSettingsSchema
>;
