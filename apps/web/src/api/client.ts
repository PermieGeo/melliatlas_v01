// Feature IDs: WEATHER.POINT_FORECAST, NOTICES.MAP_OVERLAY, SOURCES.DOCUMENT_HISTORY
import {
  apiErrorSchema,
  inspectionResponseSchema,
  mapTreatmentsResponseSchema,
  type Coordinates,
  type InspectionResponse,
  type MapTreatment,
  viewportCollectionSelectionSchema,
  viewportCollectionResultSchema,
  saturnDistrictCatalogResponseSchema,
  saturnRegionCatalogResponseSchema,
  saturnDistrictPointsResponseSchema,
  type ViewportCollectionSelection,
  type ViewportCollectionResult,
  type SaturnDistrictCatalogResponse,
  type SaturnRegionCatalogResponse,
  type SaturnDistrictPointsResponse,
} from "@melliatlas/contracts";

export class ApiRequestError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

async function decode(response: Response): Promise<unknown> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const parsed = apiErrorSchema.safeParse(payload);
    throw new ApiRequestError(
      parsed.success ? parsed.data.error.code : "REQUEST_FAILED",
    );
  }
  return response.json();
}

export async function inspectLocation(
  point: Coordinates,
  signal: AbortSignal,
): Promise<InspectionResponse> {
  const query = new URLSearchParams({
    lat: String(point.lat),
    lon: String(point.lon),
  });
  return inspectionResponseSchema.parse(
    await decode(await fetch(`/api/v1/locations/inspect?${query}`, { signal })),
  );
}

export async function loadMapTreatments(
  signal: AbortSignal,
  bbox?: readonly [number, number, number, number],
): Promise<MapTreatment[]> {
  const query = bbox
    ? `?bbox=${bbox.map((point) => point.toFixed(6)).join(",")}`
    : "";
  const response = await fetch(`/api/v1/notices${query}`, {
    signal,
    cache: "no-store",
  });
  return mapTreatmentsResponseSchema.parse(await decode(response)).notices;
}

/** Inspect or advance one locally enabled, bounded viewport index without operator access. */
async function clientViewportRequest(
  action: "status" | "next",
  selection: ViewportCollectionSelection,
): Promise<ViewportCollectionResult> {
  const validated = viewportCollectionSelectionSchema.parse(selection);
  const response = await fetch(`/api/v1/map/saturn-viewport/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validated),
    cache: "no-store",
  });
  return viewportCollectionResultSchema.parse(await decode(response));
}

export function loadDistrictViewportProgress(
  selection: ViewportCollectionSelection,
): Promise<ViewportCollectionResult> {
  return clientViewportRequest("status", selection);
}

export function fetchDistrictViewportPage(
  selection: ViewportCollectionSelection,
): Promise<ViewportCollectionResult> {
  return clientViewportRequest("next", selection);
}

/** Return the operator-seeded region allowlist without contacting the provider. */
export async function loadSaturnRegions(): Promise<SaturnRegionCatalogResponse> {
  return saturnRegionCatalogResponseSchema.parse(
    await decode(
      await fetch("/api/v1/map/saturn-viewport/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      }),
    ),
  );
}

/** Return the cached district directory for a selected region; no provider traffic. */
export async function loadSaturnDistrictCatalog(
  regionCode: string,
): Promise<SaturnDistrictCatalogResponse> {
  return saturnDistrictCatalogResponseSchema.parse(
    await decode(
      await fetch("/api/v1/map/saturn-viewport/districts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionCode }),
        cache: "no-store",
      }),
    ),
  );
}

/** Explicitly refresh the provider's district directory once. */
export async function refreshSaturnDistrictCatalog(
  regionCode: string,
): Promise<SaturnDistrictCatalogResponse> {
  return saturnDistrictCatalogResponseSchema.parse(
    await decode(
      await fetch("/api/v1/map/saturn-viewport/districts/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionCode }),
        cache: "no-store",
      }),
    ),
  );
}

/** All stored centers of one district, even when the map's exact viewport key changes. */
export async function loadSavedDistrictPoints(
  regionCode: string,
  districtId: number,
): Promise<SaturnDistrictPointsResponse> {
  return saturnDistrictPointsResponseSchema.parse(
    await decode(
      await fetch("/api/v1/map/saturn-viewport/district-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionCode, districtId }),
        cache: "no-store",
      }),
    ),
  );
}
