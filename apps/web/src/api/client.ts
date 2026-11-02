// Feature IDs: WEATHER.POINT_FORECAST, NOTICES.MAP_OVERLAY
import {
  apiErrorSchema,
  inspectionResponseSchema,
  mapTreatmentsResponseSchema,
  type Coordinates,
  type InspectionResponse,
  type MapTreatment,
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
): Promise<MapTreatment[]> {
  const response = await fetch("/api/v1/notices", {
    signal,
    cache: "no-store",
  });
  return mapTreatmentsResponseSchema.parse(await decode(response)).notices;
}
