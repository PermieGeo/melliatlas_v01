// Feature IDs: SOURCES.DOCUMENT_HISTORY
import {
  sourceDefinitionSchema,
  type SourceDefinition,
} from "../../contracts.js";
import { SOURCE_REQUEST_GAP_MS } from "../../providerRequestThrottle.js";

export const SATURN_SOURCE_ID = "treatment-feed";
export const SATURN_SUBJECT_CODE = "55";
export const SATURN_HOST = "bee-saturn.ru";
export const SATURN_ORIGIN = `https://${SATURN_HOST}`;
export const SATURN_VIEWPORT_PATH = "/backend/beemaster/query";
export const SATURN_DISTRICT_PATH = `/backend/beemaster/district/${SATURN_SUBJECT_CODE}`;
export const SATURN_LEGACY_TREATMENT_PATH = "/backend/beemaster/planapplybees";
export const SATURN_CAPTURE_POLYGON_PATH =
  "/backend/beemaster/geojson-polygons";
export const SATURN_CAPTURE_ACR_PATH_PREFIX = "/backend/beemaster/acr/";
export const SATURN_VIEWPORT_PAGE_SIZE = 10;
export const SATURN_MAX_VIEWPORT_PAGES = 2_000;
export const SATURN_MAX_VIEWPORT_ELEMENTS = 20_000;
export const SATURN_INDEX_PREVIEW_LIMIT = 100;
export const SATURN_DISTRICT_PREVIEW_LIMIT = 500;
export const SATURN_HISTORY_LIMIT = 20;
export const SATURN_HISTORY_PAGE_RECEIPTS_LIMIT = 5;
export const SATURN_REQUEST_LOG_LIMIT = 100;
export const SATURN_JSON_RESPONSE_LIMIT_BYTES = 1_000_000;
export const SATURN_JSON_REQUEST_TIMEOUT_MS = 8_000;
export const SATURN_JSON_PARSER_VERSION = "saturn-viewport-index-v1";
export const SATURN_JSON_CONTENT_TYPE = "application/json";
export const SATURN_WGS84_SRID = 4326;

/** GeoJSON uses WGS84 positions ordered [longitude, latitude], in degrees. */
export const SATURN_MIN_LONGITUDE = -180;
export const SATURN_MAX_LONGITUDE = 180;
export const SATURN_MIN_LATITUDE = -90;
export const SATURN_MAX_LATITUDE = 90;
/** A GeoJSON linear ring has at least four positions, including its closing position. */
export const SATURN_MIN_LINEAR_RING_POSITIONS = 4;
export const SATURN_MIN_POLYGON_RINGS = 1;
export const SATURN_MIN_MULTIPOLYGON_POLYGONS = 1;

/**
 * Local validation and resource budgets, not documented Saturn provider maxima.
 * Existing values are preserved until representative authorized capture sizes
 * and operational limits can be established independently.
 */
export const SATURN_MAX_DISTRICT_CATALOG_ENTRIES = 256;
export const SATURN_MIN_DISTRICT_NAME_LENGTH = 1;
export const SATURN_MAX_DISTRICT_NAME_LENGTH = 250;
export const SATURN_MIN_INDEX_FIELD_NAME_LENGTH = 1;
export const SATURN_MAX_INDEX_FIELD_NAME_LENGTH = 512;
export const SATURN_MAX_POLYGON_FEATURES = 2_000;
export const SATURN_MAX_RING_POSITIONS = 20_000;
export const SATURN_MAX_GEOMETRY_POSITIONS = 50_000;
export const SATURN_MAX_RINGS_PER_POLYGON = 100;
export const SATURN_MAX_POLYGONS_PER_MULTIPOLYGON = 100;
export const SATURN_POLYGON_JSONP_MAX_BYTES = 8 * 1024 * 1024;
export const SATURN_MAX_ACR_CAPTURE_FILES = 100;
export const SATURN_MAX_ACR_PRODUCTS = 500;
export const SATURN_VERIFIED_FALLBACK_DISTRICT_ID = 1477;
export const SATURN_LEGACY_TREATMENT_URL = `${SATURN_ORIGIN}${SATURN_LEGACY_TREATMENT_PATH}`;
export const SATURN_VIEWPORT_URL = `${SATURN_ORIGIN}${SATURN_VIEWPORT_PATH}`;
export const SATURN_DISTRICT_URL = `${SATURN_ORIGIN}${SATURN_DISTRICT_PATH}`;
// Observed capture endpoints are not registered for automatic retrieval.
export const SATURN_CAPTURE_POLYGON_URL = `${SATURN_ORIGIN}${SATURN_CAPTURE_POLYGON_PATH}`;
export const SATURN_CAPTURE_ACR_URL_PREFIX = `${SATURN_ORIGIN}${SATURN_CAPTURE_ACR_PATH_PREFIX}`;
export const SATURN_CONFIGURED_ENDPOINTS: ReadonlySet<string> = new Set([
  SATURN_LEGACY_TREATMENT_URL,
  SATURN_VIEWPORT_URL,
]);

/** Persisted values and API route names must remain backward compatible. */
export enum SaturnViewportState {
  Partial = "partial",
  Complete = "viewport_index_complete",
}

export enum SaturnSourceKind {
  Treatment = "treatment",
}

export enum SaturnSourceLifecycle {
  Configured = "configured",
}

export enum SaturnRequestInitiator {
  Web = "web",
  Admin = "admin",
}

export enum SaturnRequestAction {
  ViewportPage = "viewport_page",
  DistrictDirectory = "district_directory",
}

export enum SaturnRequestOutcome {
  Started = "started",
  Succeeded = "succeeded",
  Failed = "failed",
  Throttled = "throttled",
  CacheHit = "cache_hit",
}

export enum SaturnViewportRouteAction {
  Status = "status",
  Next = "next",
}

export enum SaturnCaptureStatus {
  IdentityOnly = "ID_ONLY_UNVERIFIED",
  MetadataHashBound = "SELF_REPORTED_METADATA_HASH_BOUND",
  NoManifest = "NOT_PROVIDED",
}

export enum SaturnBboxRelation {
  Identical = "identical",
  Overlapping = "overlapping",
  Disjoint = "disjoint",
}

/** Keep one strict outbound policy for Saturn's two observed JSON endpoints. */
export function saturnJsonSource(name: string, path: string): SourceDefinition {
  return sourceDefinitionSchema.parse({
    id: SATURN_SOURCE_ID,
    name,
    kind: SaturnSourceKind.Treatment,
    enabled: true,
    locations: [{ hostname: SATURN_HOST, pathPrefixes: [path] }],
    review: { decision: SaturnSourceLifecycle.Configured },
    parserVersion: SATURN_JSON_PARSER_VERSION,
    fetchPolicy: {
      timeoutMs: SATURN_JSON_REQUEST_TIMEOUT_MS,
      maxResponseBytes: SATURN_JSON_RESPONSE_LIMIT_BYTES,
      minIntervalMs: SOURCE_REQUEST_GAP_MS,
      maxRedirects: 0,
      maxRetries: 0,
      allowedContentTypes: [SATURN_JSON_CONTENT_TYPE],
    },
  });
}
