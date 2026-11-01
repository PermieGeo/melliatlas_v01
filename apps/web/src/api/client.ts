// Feature IDs: SOURCES.CATALOG, WEATHER.POINT_FORECAST, SOURCES.PROVIDER_CONFIGURATION, NOTICES.MAP_OVERLAY
import {
  apiErrorSchema,
  mapTreatmentsResponseSchema,
  providerCollectionStatusSchema,
  type ProviderCollectionStatus,
  type MapTreatment,
  providerConfigurationSchema,
  providerConfigurationEditSchema,
  type ProviderConfiguration,
  type ProviderConfigurationEdit,
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

export async function loadProviderConfiguration(
  token: string,
): Promise<ProviderConfiguration> {
  const response = await fetch("/api/v1/operator/provider", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return providerConfigurationSchema.parse(await decodeApiResponse(response));
}

export async function saveProviderConfiguration(
  token: string,
  input: ProviderConfigurationEdit,
): Promise<ProviderConfiguration> {
  const validated = providerConfigurationEditSchema.parse(input);
  const response = await fetch("/api/v1/operator/provider", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(validated),
    cache: "no-store",
  });
  return providerConfigurationSchema.parse(await decodeApiResponse(response));
}

export async function loadMapTreatments(
  signal: AbortSignal,
): Promise<MapTreatment[]> {
  const response = await fetch("/api/v1/notices", {
    signal,
    cache: "no-store",
  });
  return mapTreatmentsResponseSchema.parse(await decodeApiResponse(response))
    .notices;
}

async function operatorRequest(
  token: string,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  return decodeApiResponse(response);
}

export async function syncProviderPage(
  token: string,
): Promise<{ received: number; stored: number; nextPage: number }> {
  return (await operatorRequest(
    token,
    "/api/v1/operator/provider/sync",
    "POST",
    {},
  )) as { received: number; stored: number; nextPage: number };
}
export type PendingTreatment = {
  id: string;
  sourceUrl: string;
  retrievedAt: string;
  contractorName: string | null;
  cadastralNumber: string | null;
  geometryAvailable: boolean;
  startAt: string | null;
  endAt: string | null;
  treatments: Array<{
    name: string | null;
    crop: string | null;
    beeHazardClass: number | null;
  }>;
};
export async function loadPendingTreatments(
  token: string,
): Promise<PendingTreatment[]> {
  const result = (await operatorRequest(token, "/api/v1/operator/notices")) as {
    notices: PendingTreatment[];
  };
  return result.notices;
}
export async function reviewTreatment(
  token: string,
  id: string,
  decision: "verified" | "rejected",
  reviewer: string,
  evidenceNote: string,
): Promise<void> {
  await operatorRequest(
    token,
    `/api/v1/operator/notices/${encodeURIComponent(id)}/review`,
    "POST",
    { decision, reviewer, evidenceNote },
  );
}

/** Source diagnostics require operator authentication and never expose raw records. */
export async function loadProviderCollectionStatus(
  token: string,
): Promise<ProviderCollectionStatus> {
  return providerCollectionStatusSchema.parse(
    await operatorRequest(token, "/api/v1/operator/provider/status"),
  );
}
