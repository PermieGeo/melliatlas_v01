// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { sourceDefinitionSchema, type SourceDefinition } from "./contracts.js";
import { SOURCE_REQUEST_GAP_MS } from "./providerRequestThrottle.js";

export const SATURN_SOURCE_ID = "treatment-feed";
export const SATURN_VIEWPORT_URL =
  "https://bee-saturn.ru/backend/beemaster/query";
export const SATURN_DISTRICT_URL =
  "https://bee-saturn.ru/backend/beemaster/district/55";

/** Keep one strict outbound policy for Saturn's two observed JSON endpoints. */
export function saturnJsonSource(name: string, path: string): SourceDefinition {
  return sourceDefinitionSchema.parse({
    id: SATURN_SOURCE_ID,
    name,
    kind: "treatment",
    enabled: true,
    locations: [{ hostname: "bee-saturn.ru", pathPrefixes: [path] }],
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
}
