// Feature IDs: SOURCES.DOCUMENT_HISTORY
import {
  parseSaturnViewportPage,
  validateSaturnViewportQuery,
  type SaturnViewportPage,
  type SaturnViewportQuery,
} from "./saturnViewportQuery.js";
import {
  SATURN_MAX_VIEWPORT_ELEMENTS,
  SATURN_MAX_VIEWPORT_PAGES,
} from "./sourceProfile.js";

export type SaturnViewportProgress = {
  /** The exact map-index filter; this is not a district-wide history key. */
  firstPageRequest: SaturnViewportQuery;
  status: "partial" | "viewport_index_complete";
  nextPage: number | null;
  pagesFetched: number;
  totalPages: number | null;
  totalElements: number | null;
  entries: SaturnViewportPage["entries"];
};

/** Start an offline listing with a validated, immutable first-page filter. */
export function startSaturnViewportProgress(
  request: SaturnViewportQuery,
): SaturnViewportProgress {
  const validated = validateSaturnViewportQuery(request);
  if (validated.pageNumber !== 0) {
    throw new Error("Saturn viewport listing must start at page zero");
  }
  return {
    firstPageRequest: structuredClone(validated),
    status: "partial",
    nextPage: 0,
    pagesFetched: 0,
    totalPages: null,
    totalElements: null,
    entries: [],
  };
}

/**
 * Reconcile one captured page against the original viewport, district and
 * UpdateMap window. A terminal index listing is NOT historical coverage,
 * verified treatment evidence, or a complete collection of source polygons.
 *
 * The function performs no network or database access. Consumers must commit
 * progress and raw source evidence atomically before treating it as durable.
 */
export function advanceSaturnViewportProgress(
  state: SaturnViewportProgress,
  body: unknown,
): SaturnViewportProgress {
  if (state.status !== "partial" || state.nextPage === null) {
    throw new Error("Saturn viewport listing is already terminal");
  }
  if (state.pagesFetched !== state.nextPage) {
    throw new Error("Saturn viewport listing has inconsistent progress");
  }
  const request = validateSaturnViewportQuery({
    ...state.firstPageRequest,
    pageNumber: state.nextPage,
  });
  const page = parseSaturnViewportPage(body, request);
  if (
    (state.totalPages !== null && state.totalPages !== page.totalPages) ||
    (state.totalElements !== null && state.totalElements !== page.totalElements)
  ) {
    throw new Error("Saturn viewport listing totals changed between pages");
  }
  const totalPages = state.totalPages ?? page.totalPages;
  const totalElements = state.totalElements ?? page.totalElements;
  if (
    totalPages > SATURN_MAX_VIEWPORT_PAGES ||
    totalElements > SATURN_MAX_VIEWPORT_ELEMENTS
  ) {
    throw new Error("Saturn viewport listing exceeds the observed page cap");
  }
  const featureIds = new Set(state.entries.map((item) => item.featureId));
  for (const item of page.entries) {
    if (featureIds.has(item.featureId)) {
      throw new Error("Saturn viewport feature repeated across pages");
    }
    featureIds.add(item.featureId);
  }
  const entries = [...state.entries, ...page.entries];
  if (entries.length > totalElements) {
    throw new Error("Saturn viewport listing exceeded its reported total");
  }
  if (page.nextPage === null && entries.length !== totalElements) {
    throw new Error("Saturn viewport terminal page has missing entries");
  }
  return {
    firstPageRequest: state.firstPageRequest,
    status: page.nextPage === null ? "viewport_index_complete" : "partial",
    nextPage: page.nextPage,
    pagesFetched: state.pagesFetched + 1,
    totalPages,
    totalElements,
    entries,
  };
}

/** Count distinct source plan IDs without merging map feature IDs. */
export function countViewportPlanIds(state: SaturnViewportProgress): number {
  return new Set(state.entries.map((item) => item.planId)).size;
}
