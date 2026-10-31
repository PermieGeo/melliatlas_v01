// Feature IDs: SRC-01
import {
  apiErrorSchema,
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
