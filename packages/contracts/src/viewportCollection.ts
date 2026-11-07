// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A deliberately bounded Smolensk pilot selection shared by local operator and beekeeper views. */
export const viewportCollectionSelectionSchema = z
  .object({
    districtId: z.literal(1477),
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
