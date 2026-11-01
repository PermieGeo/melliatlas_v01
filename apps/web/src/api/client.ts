// Feature IDs: SOURCES.CATALOG, WEATHER.POINT_FORECAST, SOURCES.SATURN_CONFIGURATION
import {
  apiErrorSchema,
  saturnConfigurationSchema,
  saturnConfigurationEditSchema,
  type SaturnConfiguration,
  type SaturnConfigurationEdit,
  inspectionResponseSchema,
  sourceCatalogResponseSchema,
  type Coordinates,
  type InspectionResponse,
  type SourceCatalogEntry,
} from "@melliatlas/contracts";

async function decodeApiResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const parsed = apiErrorSchema.safeParse(payload);
    const translations: Record<string, string> = {
      SOURCE_UNAVAILABLE:
        "Источник данных временно недоступен. Повторите запрос позже.",
      INVALID_COORDINATES: "Проверьте координаты выбранной точки.",
      RATE_LIMITED: "Слишком много запросов. Подождите немного.",
    };
    throw new Error(
      parsed.success
        ? (translations[parsed.data.error.code] ?? parsed.data.error.message)
        : `Ошибка запроса к серверу (${response.status})`,
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
  const response = await fetch(`/api/v1/locations/inspect?${query}`, {
    signal,
  });
  return inspectionResponseSchema.parse(await decodeApiResponse(response));
}

export async function loadSourceCatalog(
  signal: AbortSignal,
): Promise<SourceCatalogEntry[]> {
  const response = await fetch("/api/v1/sources", { signal });
  return sourceCatalogResponseSchema.parse(await decodeApiResponse(response))
    .sources;
}


export async function loadSaturnConfiguration(token: string): Promise<SaturnConfiguration> {
  const response = await fetch("/api/v1/operator/saturn", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return saturnConfigurationSchema.parse(await decodeApiResponse(response));
}

export async function saveSaturnConfiguration(
  token: string,
  input: SaturnConfigurationEdit,
): Promise<SaturnConfiguration> {
  const validated = saturnConfigurationEditSchema.parse(input);
  const response = await fetch("/api/v1/operator/saturn", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(validated),
    cache: "no-store",
  });
  return saturnConfigurationSchema.parse(await decodeApiResponse(response));
}
