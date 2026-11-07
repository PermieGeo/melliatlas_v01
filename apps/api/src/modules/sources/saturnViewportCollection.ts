// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { z } from "zod";
import type { Pool } from "pg";
import {
  viewportCollectionSelectionSchema,
  type ViewportCollectionResult,
  type ViewportCollectionSelection,
  type ViewportCacheHistoryResponse,
} from "@melliatlas/contracts";
import { ApiFailure } from "../../lib/errors.js";
import { sourceDefinitionSchema } from "./contracts.js";
import { RestrictedSourceFetcher, SourceFetchFailure } from "./httpFetcher.js";
import {
  ProviderRequestThrottle,
  SOURCE_REQUEST_GAP_MS,
  type ProviderRequestGate,
} from "./providerRequestThrottle.js";
import {
  SaturnViewportIndexRepository,
  type ViewportIndexKey,
} from "./saturnViewportIndexRepository.js";
import { listViewportCacheHistory } from "./saturnViewportCacheHistory.js";
import {
  parseSaturnViewportPage,
  validateSaturnViewportQuery,
  type SaturnViewportQuery,
} from "./saturnViewportQuery.js";

const SOURCE_ID = "treatment-feed";
const SOURCE_URL = "https://bee-saturn.ru/backend/beemaster/query";
const CONFIGURED_ENDPOINTS = new Set([
  "https://bee-saturn.ru/backend/beemaster/planapplybees",
  SOURCE_URL,
]);

type SourceRow = {
  registry_revision: string;
  name: string;
  kind: string;
  lifecycle: string;
  url: string;
  api_request_config: unknown;
};
type IndexPort = Pick<
  SaturnViewportIndexRepository,
  "getStatus" | "appendCapturedPage" | "listFeatures"
>;
type FetchPort = Pick<RestrictedSourceFetcher, "fetch">;

/** Construct a validated, bounded single-viewport request; never a whole-district request. */
export function makeViewportFirstRequest(
  selection: ViewportCollectionSelection,
): SaturnViewportQuery {
  const parsed = viewportCollectionSelectionSchema.parse(selection);
  return validateSaturnViewportQuery({
    filter: {
      leftTop: { longitude: parsed.bbox.west, latitude: parsed.bbox.north },
      rightDown: { longitude: parsed.bbox.east, latitude: parsed.bbox.south },
      subject: "55",
      district: String(parsed.districtId),
      startDateUpdateMap: `${parsed.fromDate}T00:00:00.000Z`,
      endDateUpdateMap: `${parsed.toDate}T00:00:00.000Z`,
      culture: [],
      classesDangerBee: [],
      classesDangerMan: [],
      query: null,
    },
    pageNumber: 0,
    pageSize: 10,
  });
}

/** One explicitly requested upstream page per call, persisted in the existing viewport index. */
export class SaturnViewportCollectionService {
  private readonly index: IndexPort;
  private readonly fetcher: FetchPort;
  private readonly gate: ProviderRequestGate;

  constructor(
    private readonly pool: Pick<Pool, "query">,
    private readonly enabled = false,
    dependencies: {
      index?: IndexPort;
      fetcher?: FetchPort;
      gate?: ProviderRequestGate;
    } = {},
  ) {
    this.index =
      dependencies.index ?? new SaturnViewportIndexRepository(pool as Pool);
    this.fetcher = dependencies.fetcher ?? new RestrictedSourceFetcher();
    this.gate = dependencies.gate ?? new ProviderRequestThrottle(pool as Pool);
  }

  private async key(
    selection: ViewportCollectionSelection,
  ): Promise<{ key: ViewportIndexKey; name: string }> {
    const firstPageRequest = makeViewportFirstRequest(selection);
    const result = await this.pool.query<SourceRow>(
      `SELECT registry_revision::text, name, kind, lifecycle, url, api_request_config
       FROM source_catalog WHERE id=$1`,
      [SOURCE_ID],
    );
    const source = result.rows[0];
    const config = z
      .object({ endpoint: z.string() })
      .passthrough()
      .safeParse(source?.api_request_config);
    if (
      !source ||
      source.kind !== "treatment" ||
      source.lifecycle !== "configured" ||
      !CONFIGURED_ENDPOINTS.has(source.url) ||
      !config.success ||
      config.data.endpoint !== source.url
    ) {
      throw new ApiFailure(
        409,
        "SATURN_VIEWPORT_NOT_CONFIGURED",
        "Configure the Saturn provider endpoint first",
      );
    }
    return {
      key: {
        sourceId: SOURCE_ID,
        sourceRevision: source.registry_revision,
        firstPageRequest,
      },
      name: source.name,
    };
  }

  async status(
    selection: ViewportCollectionSelection,
  ): Promise<ViewportCollectionResult> {
    const { key } = await this.key(selection);
    const progress = await this.index.getStatus(key);
    return {
      enabled: this.enabled,
      progress,
      cachedCenters: progress ? await this.index.listFeatures(key, 100) : [],
    };
  }

  /** Inspect stored pages from both client and operator workflows, even when live access is disabled. */
  history(): Promise<ViewportCacheHistoryResponse> {
    return listViewportCacheHistory(this.pool);
  }

  /** Never retries automatically; 429/503 responses consume the shared throttle slot. */
  async fetchNext(
    selection: ViewportCollectionSelection,
  ): Promise<ViewportCollectionResult> {
    if (!this.enabled) {
      throw new ApiFailure(
        409,
        "SATURN_VIEWPORT_DISABLED",
        "Explicit Saturn viewport access is disabled",
      );
    }
    const { key, name } = await this.key(selection);
    const previous = await this.index.getStatus(key);
    if (previous?.state === "viewport_index_complete") {
      return {
        enabled: true,
        progress: previous,
        cachedCenters: await this.index.listFeatures(key, 100),
      };
    }
    if (previous && !previous.sourceRevisionCurrent) {
      throw new ApiFailure(
        409,
        "SOURCE_CHANGED",
        "The provider configuration has changed",
      );
    }
    const pageNumber = previous?.nextPage ?? 0;
    if (pageNumber >= 2000) {
      throw new ApiFailure(
        409,
        "VIEWPORT_PAGE_LIMIT",
        "Viewport page limit reached",
      );
    }
    if (!(await this.gate.reserve(SOURCE_ID))) {
      throw new ApiFailure(
        429,
        "SOURCE_THROTTLED",
        "Provider request cooldown is active",
      );
    }
    const request = validateSaturnViewportQuery({
      ...key.firstPageRequest,
      pageNumber,
    });
    const source = sourceDefinitionSchema.parse({
      id: SOURCE_ID,
      name,
      kind: "treatment",
      enabled: true,
      locations: [
        {
          hostname: "bee-saturn.ru",
          pathPrefixes: ["/backend/beemaster/query"],
        },
      ],
      review: { decision: "configured" },
      parserVersion: "saturn-viewport-index-v1",
      fetchPolicy: {
        timeoutMs: 8_000,
        maxResponseBytes: 1_000_000,
        minIntervalMs: SOURCE_REQUEST_GAP_MS,
        maxRedirects: 0,
        maxRetries: 0,
        allowedContentTypes: ["application/json"],
      },
    });
    let body: unknown;
    try {
      const response = await this.fetcher.fetch(source, {
        url: SOURCE_URL,
        method: "POST",
        body: JSON.stringify(request),
      });
      body = JSON.parse(response.bytes.toString("utf8")) as unknown;
      parseSaturnViewportPage(body, request);
    } catch (error) {
      if (error instanceof SourceFetchFailure) {
        throw new ApiFailure(
          error.code === "RATE_LIMITED" ? 429 : 502,
          error.code === "RATE_LIMITED"
            ? "SOURCE_THROTTLED"
            : "SOURCE_UNAVAILABLE",
          "Unable to retrieve the requested Saturn page",
        );
      }
      throw new ApiFailure(
        502,
        "INVALID_SOURCE_RESPONSE",
        "Saturn returned an invalid map-index page",
      );
    }
    const progress = await this.index.appendCapturedPage(key, body);
    return {
      enabled: true,
      progress,
      cachedCenters: await this.index.listFeatures(key, 100),
    };
  }
}
