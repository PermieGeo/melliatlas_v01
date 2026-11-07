// Feature IDs: SOURCES.DOCUMENT_HISTORY, SOURCES.CATALOG, SOURCES.PROVIDER_CONFIGURATION, NOTICES.MAP_OVERLAY
import {
  apiErrorSchema,
  viewportCollectionSelectionSchema,
  viewportCollectionResultSchema,
  viewportCacheHistoryResponseSchema,
  type ViewportCollectionSelection,
  type ViewportCollectionResult,
  type ViewportCacheHistoryResponse,
  mapTreatmentsResponseSchema,
  providerCollectionStatusSchema,
  districtCacheStatusSchema,
  type DistrictCacheStatus,
  type ProviderCollectionStatus,
  type MapTreatment,
  providerConfigurationSchema,
  providerConfigurationEditSchema,
  type ProviderConfiguration,
  type ProviderConfigurationEdit,
  sourceCatalogResponseSchema,
  type SourceCatalogEntry,
} from "@melliatlas/contracts";

async function decodeApiResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const parsed = apiErrorSchema.safeParse(payload);
    throw new Error(parsed.success ? parsed.data.error.code : "REQUEST_FAILED");
  }
  return response.json();
}

export async function loadSourceCatalog(
  signal: AbortSignal,
): Promise<SourceCatalogEntry[]> {
  const response = await fetch("/api/v1/sources", { signal });
  return sourceCatalogResponseSchema.parse(await decodeApiResponse(response))
    .sources;
}

export async function loadProviderConfiguration(): Promise<ProviderConfiguration> {
  const response = await fetch("/api/v1/operator/provider", {
    cache: "no-store",
  });
  return providerConfigurationSchema.parse(await decodeApiResponse(response));
}

export async function saveProviderConfiguration(
  input: ProviderConfigurationEdit,
): Promise<ProviderConfiguration> {
  const validated = providerConfigurationEditSchema.parse(input);
  const response = await fetch("/api/v1/operator/provider", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validated),
    cache: "no-store",
  });
  return providerConfigurationSchema.parse(await decodeApiResponse(response));
}

export async function loadPreviewMapTreatments(
  signal: AbortSignal,
): Promise<MapTreatment[]> {
  const response = await fetch("/api/v1/operator/notices/map-preview", {
    signal,
    cache: "no-store",
  });
  return mapTreatmentsResponseSchema.parse(await decodeApiResponse(response))
    .notices;
}

async function operatorRequest(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  return decodeApiResponse(response);
}

export async function syncProviderPage(): Promise<{
  received: number;
  stored: number;
  nextPage: number;
}> {
  return (await operatorRequest(
    "/api/v1/operator/provider/sync",
    "POST",
    {},
  )) as {
    received: number;
    stored: number;
    nextPage: number;
  };
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
export async function loadPendingTreatments(): Promise<PendingTreatment[]> {
  const result = (await operatorRequest("/api/v1/operator/notices")) as {
    notices: PendingTreatment[];
  };
  return result.notices;
}
export async function reviewTreatment(
  id: string,
  decision: "verified" | "rejected",
  reviewer: string,
  evidenceNote: string,
): Promise<void> {
  await operatorRequest(
    `/api/v1/operator/notices/${encodeURIComponent(id)}/review`,
    "POST",
    { decision, reviewer, evidenceNote },
  );
}

/** Source diagnostics describe persisted ingestion without returning raw provider records. */
export async function loadProviderCollectionStatus(): Promise<ProviderCollectionStatus> {
  return providerCollectionStatusSchema.parse(
    await operatorRequest("/api/v1/operator/provider/status"),
  );
}

export async function loadDistrictCacheStatus(): Promise<DistrictCacheStatus> {
  return districtCacheStatusSchema.parse(
    await operatorRequest("/api/v1/operator/provider/district-cache"),
  );
}

/** Read a stored viewport checkpoint without contacting Saturn. */
export async function loadViewportProgress(
  selection: ViewportCollectionSelection,
): Promise<ViewportCollectionResult> {
  return viewportCollectionResultSchema.parse(
    await operatorRequest(
      "/api/v1/operator/provider/viewport/status",
      "POST",
      viewportCollectionSelectionSchema.parse(selection),
    ),
  );
}

/** Fetch and persist at most one provider page per explicit operator action. */
export async function fetchViewportNextPage(
  selection: ViewportCollectionSelection,
): Promise<ViewportCollectionResult> {
  return viewportCollectionResultSchema.parse(
    await operatorRequest(
      "/api/v1/operator/provider/viewport/next",
      "POST",
      viewportCollectionSelectionSchema.parse(selection),
    ),
  );
}

/** Read committed map-index page history across Web and Admin without contacting Saturn. */
export async function loadViewportCacheHistory(): Promise<ViewportCacheHistoryResponse> {
  return viewportCacheHistoryResponseSchema.parse(
    await operatorRequest("/api/v1/operator/provider/viewport/history"),
  );
}
