// Feature IDs: SOURCES.PROVIDER_CONFIGURATION
import { isDeepStrictEqual } from "node:util";
import { providerRequestSettingsSchema } from "@melliatlas/contracts";
import type { Pool } from "pg";
import { z } from "zod";
import { validateProviderEndpoint } from "./providerConfiguration.js";

const presetSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.literal("treatment"),
  url: z.string().min(1),
  apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]{0,99}$/).optional(),
  request: providerRequestSettingsSchema,
}).strict();

export type ProviderSeed = z.infer<typeof presetSchema>;
export type ProviderSeedResult = "inserted" | "updated" | "unchanged" | "preserved_customization";

export function parseProviderSeed(value: unknown): ProviderSeed {
  const preset = presetSchema.parse(value);
  return { ...preset, url: validateProviderEndpoint(preset.url) };
}

const SOURCE_ID = "treatment-feed";
const LEGACY_NAME = "External treatment provider";

type ExistingRow = {
  name: string;
  kind: string;
  url: string;
  api_key: string | null;
  api_request_config: unknown;
  lifecycle: string;
  access_decision: string;
};

/** Seed one explicitly selected provider without touching customized settings or granting fetch approval. */
export async function seedProvider(
  pool: Pool,
  preset: ProviderSeed,
  options: { replace?: boolean; environment?: NodeJS.ProcessEnv } = {},
): Promise<ProviderSeedResult> {
  const validated = parseProviderSeed(preset);
  const environment = options.environment ?? process.env;
  const apiKey = validated.apiKeyEnv ? environment[validated.apiKeyEnv] : null;
  if (validated.apiKeyEnv && !apiKey) {
    throw new Error(`Missing provider credential environment variable: ${validated.apiKeyEnv}`);
  }
  if (apiKey && (apiKey.length > 4096 || apiKey.length < 1)) {
    throw new Error("Provider credential length is invalid");
  }

  const connection = { endpoint: validated.url, request: validated.request };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('melliatlas_provider_seed'))");
    const rows = await client.query<ExistingRow>(
      `SELECT name, kind, url, api_key, api_request_config, lifecycle, access_decision
         FROM source_catalog WHERE id = $1 FOR UPDATE`,
      [SOURCE_ID],
    );
    const existing = rows.rows[0];
    if (!existing) {
      await client.query(
        `INSERT INTO source_catalog
           (id, name, kind, url, api_key, api_request_config, lifecycle, terms_review, access_decision, data_purpose)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'under_review', 'pending', 'pending', $7)`,
        [SOURCE_ID, validated.name, validated.type, validated.url, apiKey,
          JSON.stringify(connection), "Configured treatment publication source; access review required"],
      );
      await client.query("COMMIT");
      return "inserted";
    }

    const equivalent = existing.name === validated.name && existing.kind === validated.type
      && existing.url === validated.url && existing.api_key === apiKey
      && isDeepStrictEqual(existing.api_request_config, connection);
    if (equivalent && (!options.replace || (
      existing.lifecycle === "under_review" && existing.access_decision === "pending"
    ))) {
      await client.query("COMMIT");
      return "unchanged";
    }

    // Only a pristine migration placeholder is eligible for automatic replacement.
    const pristine = existing.name === LEGACY_NAME
      && existing.kind === "treatment"
      && existing.lifecycle === "under_review"
      && existing.access_decision === "pending"
      && existing.api_key === null
      && isDeepStrictEqual(existing.api_request_config, connection)
      && existing.url === new URL(validated.url).origin + "/";
    if (!options.replace && !pristine) {
      await client.query("COMMIT");
      return "preserved_customization";
    }

    await client.query(
      `UPDATE source_catalog SET
         name = $2, kind = $3, url = $4, api_key = $5,
         api_request_config = $6::jsonb, lifecycle = 'under_review',
         access_decision = 'pending', terms_review = 'pending', source_cursor = NULL,
         allowed_locations = '[]'::jsonb, fetch_policy = NULL,
         reviewed_by = NULL, reviewed_at = NULL,
         permission_evidence_url = NULL, permission_basis = NULL, parser_version = NULL
       WHERE id = $1`,
      [SOURCE_ID, validated.name, validated.type, validated.url, apiKey,
        JSON.stringify(connection)],
    );
    await client.query("COMMIT");
    return "updated";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
