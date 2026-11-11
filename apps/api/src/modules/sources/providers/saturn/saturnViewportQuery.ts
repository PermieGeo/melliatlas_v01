// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { z } from "zod";
import { parseSaturnDistrictCatalog } from "./saturnMapEvidence.js";
import {
  SATURN_MAX_VIEWPORT_PAGES,
  SATURN_SUBJECT_CODE,
  SATURN_VIEWPORT_PAGE_SIZE,
} from "./sourceProfile.js";

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
    subject: z.literal(SATURN_SUBJECT_CODE),
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
    pageNumber: z
      .number()
      .int()
      .min(0)
      .max(SATURN_MAX_VIEWPORT_PAGES - 1),
    pageSize: z.literal(SATURN_VIEWPORT_PAGE_SIZE),
  })
  .strict();
const undatedCaptureRequestSchema = requestSchema.extend({
  filter: viewportFilterSchema.omit({
    startDateUpdateMap: true,
    endDateUpdateMap: true,
  }),
});
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
    content: z.array(summarySchema).max(SATURN_VIEWPORT_PAGE_SIZE),
    totalPages: z.number().int().nonnegative().max(SATURN_MAX_VIEWPORT_PAGES),
    totalElements: z.number().int().nonnegative().safe(),
    last: z.boolean(),
    first: z.boolean(),
    numberOfElements: z.number().int().min(0).max(SATURN_VIEWPORT_PAGE_SIZE),
    number: z.number().int().nonnegative(),
    size: z.literal(SATURN_VIEWPORT_PAGE_SIZE),
    empty: z.boolean(),
    pageable: z
      .object({
        pageNumber: z.number().int().nonnegative(),
        pageSize: z.literal(SATURN_VIEWPORT_PAGE_SIZE),
      })
      .passthrough(),
  })
  .passthrough();

export type SaturnViewportQuery = z.infer<typeof requestSchema>;
export type SaturnCapturedViewportQuery =
  SaturnViewportQuery | z.infer<typeof undatedCaptureRequestSchema>;
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
  return validateSaturnViewportQuery({
    filter: {
      leftTop: { longitude: west, latitude: north },
      rightDown: { longitude: east, latitude: south },
      subject: SATURN_SUBJECT_CODE,
      district: String(options.districtId),
      startDateUpdateMap,
      endDateUpdateMap,
      culture: [],
      classesDangerBee: [],
      classesDangerMan: [],
      query: null,
    },
    pageNumber: options.pageNumber,
    pageSize: SATURN_VIEWPORT_PAGE_SIZE,
  });
}

/** Validate the complete observed request shape before using it as a listing key. */
export function validateSaturnViewportQuery(
  input: unknown,
): SaturnViewportQuery {
  const request = requestSchema.parse(input);
  const { filter } = request;
  validateViewportBounds(filter);
  if (
    filter.startDateUpdateMap > filter.endDateUpdateMap ||
    !Number.isFinite(Date.parse(filter.startDateUpdateMap)) ||
    !Number.isFinite(Date.parse(filter.endDateUpdateMap)) ||
    new Date(filter.startDateUpdateMap).toISOString() !==
      filter.startDateUpdateMap ||
    new Date(filter.endDateUpdateMap).toISOString() !== filter.endDateUpdateMap
  ) {
    throw new Error("Invalid Saturn viewport selection");
  }
  return request;
}

function validateViewportBounds(filter: {
  leftTop: { longitude: number; latitude: number };
  rightDown: { longitude: number; latitude: number };
}): void {
  if (
    filter.leftTop.longitude >= filter.rightDown.longitude ||
    filter.leftTop.latitude <= filter.rightDown.latitude
  ) {
    throw new Error("Invalid Saturn viewport selection");
  }
}

/**
 * Accept only the two browser-observed capture shapes: both UpdateMap dates
 * present, or both absent. Production collection still requires dated queries.
 */
export function validateSaturnCapturedViewportQuery(
  input: unknown,
): SaturnCapturedViewportQuery {
  const undated = undatedCaptureRequestSchema.safeParse(input);
  if (undated.success) {
    validateViewportBounds(undated.data.filter);
    return undated.data;
  }
  return validateSaturnViewportQuery(input);
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
  const validatedRequest = validateSaturnViewportQuery(request);
  return parseSaturnPageBody(body, validatedRequest.pageNumber);
}

/** Parse a local browser capture without changing the live collection contract. */
export function parseSaturnCapturedViewportPage(
  body: unknown,
  request: SaturnCapturedViewportQuery,
): SaturnViewportPage {
  const validatedRequest = validateSaturnCapturedViewportQuery(request);
  return parseSaturnPageBody(body, validatedRequest.pageNumber);
}

function parseSaturnPageBody(
  body: unknown,
  requestedPageNumber: number,
): SaturnViewportPage {
  const page = pageSchema.parse(body);
  // Provider pagination metadata is not independently authoritative: reject
  // inconsistent headers before any caller stores the raw page and its centers.
  const expectedTotalPages = Math.ceil(page.totalElements / page.size);
  const firstPage = page.number === 0;
  const lastPage = page.totalPages === 0 || page.number === page.totalPages - 1;
  const expectedPageLength = Math.min(
    page.size,
    Math.max(0, page.totalElements - page.number * page.size),
  );
  if (
    page.number !== requestedPageNumber ||
    page.pageable.pageNumber !== page.number ||
    page.numberOfElements !== page.content.length ||
    page.empty !== (page.content.length === 0) ||
    page.first !== firstPage ||
    page.totalPages !== expectedTotalPages ||
    page.last !== lastPage ||
    (page.totalPages === 0 && page.number !== 0) ||
    (page.totalPages > 0 && page.number >= page.totalPages) ||
    page.content.length !== expectedPageLength
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
