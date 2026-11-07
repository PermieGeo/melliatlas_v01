// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A deliberately bounded Smolensk pilot selection shared by local operator and beekeeper views. */
export const viewportCollectionSelectionSchema = z
  .object({
    districtId: z.number().int().positive().safe(),
    bbox: z
      .object({
        west: z.number().finite().min(30).max(36),
        south: z.number().finite().min(53).max(56),
        east: z.number().finite().min(30).max(36),
        north: z.number().finite().min(53).max(56),
      })
      .strict(),
    fromDate: isoDate,
    toDate: isoDate,
  })
  .strict()
  .superRefine((value, ctx) => {
    const { west, east, south, north } = value.bbox;
    if (!(
      east > west &&
      north > south &&
      east - west <= 1 &&
      north - south <= 1
    )) {
      ctx.addIssue({
        code: "custom",
        message: "Viewport must be bounded and ordered",
      });
    }
    const from = new Date(`${value.fromDate}T00:00:00.000Z`);
    const to = new Date(`${value.toDate}T00:00:00.000Z`);
    if (
      !Number.isFinite(from.valueOf()) ||
      !Number.isFinite(to.valueOf()) ||
      from.toISOString().slice(0, 10) !== value.fromDate ||
      to.toISOString().slice(0, 10) !== value.toDate ||
      to.valueOf() < from.valueOf() ||
      to.valueOf() - from.valueOf() > 124 * 86_400_000
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid bounded UpdateMap window",
      });
    }
  });

export type ViewportCollectionSelection = z.infer<
  typeof viewportCollectionSelectionSchema
>;

export const viewportIndexCenterSchema = z
  .object({
    featureId: z.string().regex(/^[1-9][0-9]*$/),
    planId: z.string().regex(/^[1-9][0-9]*$/),
    centerX: z.number().finite().min(-180).max(180),
    centerY: z.number().finite().min(-90).max(90),
  })
  .strict();
export type ViewportIndexCenter = z.infer<typeof viewportIndexCenterSchema>;

export const viewportCollectionResultSchema = z
  .object({
    cachedCenters: z.array(viewportIndexCenterSchema).max(100).optional(),
    enabled: z.boolean(),
    progress: z
      .object({
        requestHash: z.string().regex(/^[a-f0-9]{64}$/),
        state: z.enum(["partial", "viewport_index_complete"]),
        nextPage: z.number().int().nonnegative().nullable(),
        pagesFetched: z.number().int().nonnegative(),
        entriesReceived: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative().nullable(),
        totalElements: z.number().int().nonnegative().nullable(),
        completedAt: z.string().datetime().nullable(),
        sourceRevisionCurrent: z.boolean(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type ViewportCollectionResult = z.infer<
  typeof viewportCollectionResultSchema
>;

/** Bounded, read-only history of actual PostgreSQL viewport-index page checkpoints. */
export const viewportCacheHistoryResponseSchema = z
  .object({
    entries: z
      .array(
        z
          .object({
            requestHash: z.string().regex(/^[0-9a-f]{64}$/),
            sourceRevision: z.string().min(1),
            sourceRevisionCurrent: z.boolean(),
            districtId: z.number().int().positive(),
            bbox: z
              .object({
                west: z.number(),
                south: z.number(),
                east: z.number(),
                north: z.number(),
              })
              .strict(),
            fromDate: isoDate,
            toDate: isoDate,
            state: z.enum(["partial", "viewport_index_complete"]),
            pagesFetched: z.number().int().nonnegative(),
            entriesReceived: z.number().int().nonnegative(),
            totalPages: z.number().int().nonnegative().nullable(),
            updatedAt: z.string().datetime(),
            recentPages: z
              .array(
                z
                  .object({
                    pageNumber: z.number().int().nonnegative(),
                    storedAt: z.string().datetime(),
                    recordCount: z.number().int().nonnegative(),
                  })
                  .strict(),
              )
              .max(5),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export type ViewportCacheHistoryResponse = z.infer<
  typeof viewportCacheHistoryResponseSchema
>;

/** Provider district directory, cached server-side and never administrative boundaries. */
export const saturnDistrictCatalogResponseSchema = z
  .object({
    enabled: z.boolean(),
    retrievedAt: z.string().datetime().nullable(),
    districts: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            name: z.string().min(1).max(250),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
          })
          .passthrough(),
      )
      .max(256),
  })
  .strict();
export type SaturnDistrictCatalogResponse = z.infer<
  typeof saturnDistrictCatalogResponseSchema
>;

/** Read-only preview of any stored center for one selected district, independent of exact viewport key. */
export const saturnDistrictPointsResponseSchema = z
  .object({
    centers: z.array(viewportIndexCenterSchema).max(500),
    totalKnown: z.number().int().nonnegative(),
  })
  .strict();
export type SaturnDistrictPointsResponse = z.infer<
  typeof saturnDistrictPointsResponseSchema
>;

export const saturnStoredFieldsResponseSchema = z
  .object({
    centers: z.array(viewportIndexCenterSchema).max(100),
  })
  .strict();
export type SaturnStoredFieldsResponse = z.infer<
  typeof saturnStoredFieldsResponseSchema
>;

/** Explicit provider request audit. An incomplete started entry may indicate a server interruption. */
export const saturnRequestLogResponseSchema = z
  .object({
    entries: z
      .array(
        z
          .object({
            id: z.string().regex(/^[1-9][0-9]*$/),
            action: z.enum(["viewport_page", "district_directory"]),
            initiator: z.enum(["web", "admin"]),
            districtId: z.number().int().positive().nullable(),
            requestHash: z
              .string()
              .regex(/^[a-f0-9]{64}$/)
              .nullable(),
            pageNumber: z.number().int().nonnegative().nullable(),
            status: z.enum([
              "started",
              "succeeded",
              "failed",
              "throttled",
              "cache_hit",
            ]),
            receivedCount: z.number().int().nonnegative().nullable(),
            errorCode: z.string().max(80).nullable(),
            startedAt: z.string().datetime(),
            finishedAt: z.string().datetime().nullable(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export type SaturnRequestLogResponse = z.infer<
  typeof saturnRequestLogResponseSchema
>;
