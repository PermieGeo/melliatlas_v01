// Feature IDs: SOURCES.SATURN_CONFIGURATION
import { isIP } from "node:net";
import {
  saturnConfigurationSchema,
  saturnRequestSettingsSchema,
  type SaturnConfiguration,
  type SaturnConfigurationEdit,
  type SaturnRequestSettings,
} from "@melliatlas/contracts";
import type { Pool } from "pg";
import { z } from "zod";
import { ApiFailure } from "../../lib/errors.js";

export function validateSaturnEndpoint(value: string): string {
  if (
    value.length > 2048 ||
    /[\\\s\u0000-\u001f\u007f]/.test(value) ||
    /%(?:00|25|2e|2f|5c)/i.test(value)
  ) {
    throw new ApiFailure(400, "INVALID_SATURN_ENDPOINT", "Invalid HTTPS endpoint");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiFailure(400, "INVALID_SATURN_ENDPOINT", "Invalid HTTPS endpoint");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.port ||
    url.search ||
    !url.hostname.includes(".") ||
    url.hostname.endsWith(".") ||
    isIP(url.hostname) ||
    !url.hostname.split(".").every((part) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part),
    ) ||
    ["localhost", "local", "internal"].includes(url.hostname.split(".").at(-1) ?? "")
  ) {
    throw new ApiFailure(400, "INVALID_SATURN_ENDPOINT", "Invalid HTTPS endpoint");
  }
  return url.toString();
}

export type SaturnRequest = {
  url: string;
  method: "GET" | "POST";
  body?: string;
};

/** Pure request builder; a caller must enforce reviewed access and DNS/transport policy before sending. */
export function buildSaturnRequest(
  endpoint: string,
  settings: SaturnRequestSettings,
): SaturnRequest {
  const url = validateSaturnEndpoint(endpoint);
  const parsed = saturnRequestSettingsSchema.parse(settings);
  const payload = {
    ...parsed.parameters,
    [parsed.regionParameter]: parsed.regionCode,
  };
  if (parsed.method === "POST") {
    return { url, method: "POST", body: JSON.stringify(payload) };
  }
  const requestUrl = new URL(url);
  for (const [key, value] of Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))) {
    requestUrl.searchParams.set(key, String(value));
  }
  return { url: requestUrl.toString(), method: "GET" };
}

const storedConnectionSchema = z.object({
  endpoint: z.string(),
  request: saturnRequestSettingsSchema,
}).strict();

type SaturnRow = {
  api_request_config: unknown;
  registry_revision: string;
  access_decision: "pending" | "approved" | "denied";
};

function parseRow(row: SaturnRow): SaturnConfiguration {
  const connection = storedConnectionSchema.parse(row.api_request_config);
  return saturnConfigurationSchema.parse({
    endpoint: connection.endpoint,
    request: connection.request,
    revision: row.registry_revision,
    accessDecision: row.access_decision,
    collectionEnabled: false,
  });
}

/** Stores only inert connection configuration. No HTTP request is initiated here. */
export class SaturnConfigurationRepository {
  constructor(private readonly pool: Pick<Pool, "query">) {}

  async get(): Promise<SaturnConfiguration> {
    const result = await this.pool.query<SaturnRow>(
      "SELECT api_request_config, registry_revision, access_decision FROM source_catalog WHERE id = 'saturn'",
    );
    if (!result.rows[0]) {
      throw new ApiFailure(503, "SATURN_NOT_CONFIGURED", "Saturn configuration migration is required");
    }
    return parseRow(result.rows[0]);
  }

  async update(input: SaturnConfigurationEdit): Promise<SaturnConfiguration> {
    const endpoint = validateSaturnEndpoint(input.endpoint);
    const settings = saturnRequestSettingsSchema.parse(input.request);
    const result = await this.pool.query<SaturnRow>(
      `UPDATE source_catalog SET api_request_config = $1::jsonb
       WHERE id = 'saturn' AND registry_revision = $2::bigint
       RETURNING api_request_config, registry_revision, access_decision`,
      [JSON.stringify({ endpoint, request: settings }), input.expectedRevision],
    );
    if (!result.rows[0]) {
      throw new ApiFailure(409, "SATURN_REVISION_CONFLICT", "Saturn configuration changed; reload before saving");
    }
    return parseRow(result.rows[0]);
  }
}
