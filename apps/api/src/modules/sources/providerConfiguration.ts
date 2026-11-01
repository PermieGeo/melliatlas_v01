// Feature IDs: SOURCES.PROVIDER_CONFIGURATION
import { isIP } from "node:net";
import {
  providerConfigurationSchema,
  providerRequestSettingsSchema,
  type ProviderConfiguration,
  type ProviderConfigurationEdit,
  type ProviderRequestSettings,
} from "@melliatlas/contracts";
import type { Pool } from "pg";
import { z } from "zod";
import { ApiFailure } from "../../lib/errors.js";

export function validateProviderEndpoint(value: string): string {
  if (
    value.length > 2048 ||
    /[\\\s\u0000-\u001f\u007f]/.test(value) ||
    /%(?:00|25|2e|2f|5c)/i.test(value)
  ) {
    throw new ApiFailure(
      400,
      "INVALID_PROVIDER_ENDPOINT",
      "Invalid HTTPS endpoint",
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiFailure(
      400,
      "INVALID_PROVIDER_ENDPOINT",
      "Invalid HTTPS endpoint",
    );
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
    !url.hostname
      .split(".")
      .every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)) ||
    ["localhost", "local", "internal"].includes(
      url.hostname.split(".").at(-1) ?? "",
    )
  ) {
    throw new ApiFailure(
      400,
      "INVALID_PROVIDER_ENDPOINT",
      "Invalid HTTPS endpoint",
    );
  }
  return url.toString();
}

export type ProviderRequest = {
  url: string;
  method: "GET" | "POST";
  body?: string;
};

/** Pure request builder; a caller must enforce reviewed access and DNS/transport policy before sending. */
export function buildProviderRequest(
  endpoint: string,
  settings: ProviderRequestSettings,
): ProviderRequest {
  const url = validateProviderEndpoint(endpoint);
  const parsed = providerRequestSettingsSchema.parse(settings);
  const payload: Record<string, unknown> = { ...parsed.parameters };
  if (parsed.regionContainer) {
    payload[parsed.regionContainer] = {
      [parsed.regionParameter]: parsed.regionCode,
    };
  } else {
    payload[parsed.regionParameter] = parsed.regionCode;
  }
  if (parsed.method === "POST") {
    return { url, method: "POST", body: JSON.stringify(payload) };
  }
  const requestUrl = new URL(url);
  for (const [key, value] of Object.entries(payload).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    requestUrl.searchParams.set(
      key,
      typeof value === "object" ? JSON.stringify(value) : String(value),
    );
  }
  return { url: requestUrl.toString(), method: "GET" };
}

const storedConnectionSchema = z
  .object({
    endpoint: z.string(),
    request: providerRequestSettingsSchema,
  })
  .strict();

type ProviderRow = {
  api_request_config: unknown;
  registry_revision: string;
  name: string;
  access_decision: "pending" | "approved" | "denied";
};

function parseRow(row: ProviderRow): ProviderConfiguration {
  const connection = storedConnectionSchema.parse(row.api_request_config);
  return providerConfigurationSchema.parse({
    providerName: row.name,
    endpoint: connection.endpoint,
    request: connection.request,
    revision: row.registry_revision,
    accessDecision: row.access_decision,
    collectionEnabled: false,
  });
}

/** Stores only inert connection configuration. No HTTP request is initiated here. */
export class ProviderConfigurationRepository {
  constructor(private readonly pool: Pick<Pool, "query">) {}

  async get(): Promise<ProviderConfiguration> {
    const result = await this.pool.query<ProviderRow>(
      "SELECT name, api_request_config, registry_revision, access_decision FROM source_catalog WHERE id = 'treatment-feed'",
    );
    if (!result.rows[0]) {
      throw new ApiFailure(
        503,
        "PROVIDER_NOT_CONFIGURED",
        "Provider configuration migration is required",
      );
    }
    return parseRow(result.rows[0]);
  }

  async update(
    input: ProviderConfigurationEdit,
  ): Promise<ProviderConfiguration> {
    const endpoint = validateProviderEndpoint(input.endpoint);
    const settings = providerRequestSettingsSchema.parse(input.request);
    const result = await this.pool.query<ProviderRow>(
      `UPDATE source_catalog SET name = $1, url = $2, api_request_config = $3::jsonb,
         lifecycle = 'under_review', access_decision = 'pending', terms_review = 'pending', api_key = NULL, source_cursor = NULL,
         allowed_locations = '[]'::jsonb, fetch_policy = NULL,
         reviewed_by = NULL, reviewed_at = NULL,
         permission_evidence_url = NULL, permission_basis = NULL, parser_version = NULL
       WHERE id = 'treatment-feed' AND registry_revision = $4::bigint
       RETURNING name, api_request_config, registry_revision, access_decision`,
      [
        input.providerName,
        endpoint,
        JSON.stringify({ endpoint, request: settings }),
        input.expectedRevision,
      ],
    );
    if (!result.rows[0]) {
      throw new ApiFailure(
        409,
        "PROVIDER_REVISION_CONFLICT",
        "Provider configuration changed; reload before saving",
      );
    }
    return parseRow(result.rows[0]);
  }
}
