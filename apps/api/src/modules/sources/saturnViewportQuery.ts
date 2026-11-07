// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { z } from "zod";
import { parseSaturnDistrictCatalog } from "./saturnMapEvidence.js";

const positionSchema = z
  .object({
    longitude: z.number().finite().min(-180).max(180),
    latitude: z.number().finite().min(-90).max(90),
  })
  .strict();
const timestampSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
const viewportFilterSchema = z
  .object({
    leftTop: positionSchema,
    rightDown: positionSchema,
    subject: z.literal("55"),
    district: z.string().regex(/^[1-9][0-9]{0,9}$/),
    startDateUpdateMap: timestampSchema,
    endDateUpdateMap: timestampSchema,
    culture: z.tuple([]),
    classesDangerBee: z.tuple([]),
    classesDangerMan: z.tuple([]),
    query: z.null(),
  })
  .strict();
const requestSchema = z
  .object({
    filter: viewportFilterSchema,
    pageNumber: z.number().int().min(0).max(1999),
    pageSize: z.literal(10),
  })
  .strict();
const summarySchema = z
  .object({
    id: z.number().int().positive().safe(),
    planId: z.number().int().positive().safe(),
    name: z.string().min(1).max(512),
    centerX: z.number().finite().min(-180).max(180),
    centerY: z.number().finite().min(-90).max(90),
  })
  .passthrough();
const pageSchema = z
  .object({
    content: z.array(summarySchema).max(10),
    totalPages: z.number().int().nonnegative().max(2000),
    totalElements: z.number().int().nonnegative().safe(),
    last: z.boolean(),
    first: z.boolean(),
    numberOfElements: z.number().int().min(0).max(10),
    number: z.number().int().nonnegative(),
    size: z.literal(10),
    empty: z.boolean(),
    pageable: z
      .object({
        pageNumber: z.number().int().nonnegative(),
        pageSize: z.literal(10),
      })
      .passthrough(),
  })
  .passthrough();

export type SaturnViewportQuery = z.infer<typeof requestSchema>;
export type SaturnViewportPage = {
  pageNumber: number;
  totalPages: number;
  totalElements: number;
  nextPage: number | null;
  entries: Array<{
    featureId: string;
    planId: string;
    centerX: number;
    centerY: number;
  }>;
};

export type SaturnViewportSelection = {
  districts: unknown;
  districtId: number;
  bbox: { west: number; south: number; east: number; north: number };
  fromDate: string;
  toDate: string;
  pageNumber: number;
};

function utcMidnight(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Expected a UTC calendar date");
  }
  const candidate = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("Invalid UTC calendar date");
  }
  return candidate.toISOString();
}

/**
 * Construct only the observed Smolensk map-index query shape for offline validation.
 * The dates select the provider's `UpdateMap` window, not verified treatment dates.
 * The district directory verifies ID membership, not its administrative boundary.
 * No HTTP request, coverage claim, or ingestion is performed by this function.
 */
export function buildSaturnViewportQuery(
  options: SaturnViewportSelection,
): SaturnViewportQuery {
  const districts = parseSaturnDistrictCatalog(options.districts);
  if (
    !Number.isSafeInteger(options.districtId) ||
    !districts.some((district) => district.id === options.districtId)
  ) {
    throw new Error("Unknown Saturn district for subject 55");
  }
  const { west, east, north, south } = options.bbox;
  if (!(west < east && south < north)) {
    throw new Error("Invalid Saturn viewport rectangle");
  }
  const startDateUpdateMap = utcMidnight(options.fromDate);
  const endDateUpdateMap = utcMidnight(options.toDate);
  if (startDateUpdateMap > endDateUpdateMap) {
    throw new Error("Saturn map update window is reversed");
  }
  return requestSchema.parse({
    filter: {
      leftTop: { longitude: west, latitude: north },
      rightDown: { longitude: east, latitude: south },
      subject: "55",
      district: String(options.districtId),
      startDateUpdateMap,
      endDateUpdateMap,
      culture: [],
      classesDangerBee: [],
      classesDangerMan: [],
      query: null,
    },
    pageNumber: options.pageNumber,
    pageSize: 10,
  });
}

/**
 * Validate one browser-observed map-index page for the exact selected viewport.
 * `nextPage === null` is a page boundary, not proof of district-history coverage.
 * These summaries are never treatment observations or source polygons.
 */
export function parseSaturnViewportPage(
  body: unknown,
  request: SaturnViewportQuery,
): SaturnViewportPage {
  const validatedRequest = requestSchema.parse(request);
  const { filter } = validatedRequest;
  if (!(
    filter.leftTop.longitude < filter.rightDown.longitude &&
    filter.leftTop.latitude > filter.rightDown.latitude &&
    filter.startDateUpdateMap <= filter.endDateUpdateMap
  )) {
    throw new Error("Invalid Saturn viewport selection");
  }
  const page = pageSchema.parse(body);
  if (
    page.number !== validatedRequest.pageNumber ||
    page.pageable.pageNumber !== page.number ||
    page.numberOfElements !== page.content.length ||
    page.empty !== (page.content.length === 0) ||
    page.first !== (page.number === 0) ||
    page.totalPages !== Math.ceil(page.totalElements / page.size) ||
    page.last !==
      (page.totalPages === 0 || page.number === page.totalPages - 1) ||
    (page.totalPages > 0 && page.number >= page.totalPages) ||
    page.content.length !==
      Math.min(
        page.size,
        Math.max(0, page.totalElements - page.number * page.size),
      )
  ) {
    throw new Error("Inconsistent Saturn map-query pagination");
  }
  const seen = new Set<number>();
  for (const entry of page.content) {
    if (seen.has(entry.id))
      throw new Error("Duplicate Saturn map feature ID in page");
    seen.add(entry.id);
  }
  return {
    pageNumber: page.number,
    totalPages: page.totalPages,
    totalElements: page.totalElements,
    nextPage: page.last ? null : page.number + 1,
    entries: page.content.map((entry) => ({
      featureId: String(entry.id),
      planId: String(entry.planId),
      centerX: entry.centerX,
      centerY: entry.centerY,
    })),
  };
}
