// Feature IDs: WEATHER.POINT_FORECAST, NOTICES.MAP_OVERLAY, SOURCES.DOCUMENT_HISTORY
import {
  apiErrorSchema,
  inspectionResponseSchema,
  mapTreatmentsResponseSchema,
  type Coordinates,
  type InspectionResponse,
  type MapTreatment,
  territoryRegionsResponseSchema,
  territoryDistrictsResponseSchema,
  type TerritoryRegionsResponse,
  type TerritoryDistrictsResponse,
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

/** Read only the configured territory names; never contact a data provider. */
export async function loadTerritoryRegions(
  signal: AbortSignal,
): Promise<TerritoryRegionsResponse> {
  return territoryRegionsResponseSchema.parse(
    await decode(
      await fetch("/api/v1/territories/regions", { signal, cache: "no-store" }),
    ),
  );
}

/** Listed district centers are navigation hints, not official administrative boundaries. */
export async function loadTerritoryDistricts(
  regionId: string,
  signal: AbortSignal,
): Promise<TerritoryDistrictsResponse> {
  const query = new URLSearchParams({ regionId });
  return territoryDistrictsResponseSchema.parse(
    await decode(
      await fetch(`/api/v1/territories/districts?${query}`, {
        signal,
        cache: "no-store",
      }),
    ),
  );
}
