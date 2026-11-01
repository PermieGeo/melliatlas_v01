// Feature IDs: SOURCES.CATALOG, SOURCES.SAFE_FETCH
import type { Pool } from "pg";
import {
  approvedSourceSchema,
  sourceIdSchema,
  type ApprovedSource,
} from "./contracts.js";

type ApprovedRow = {
  id: string;
  name: string;
  kind: string;
  lifecycle: string;
  access_decision: string;
  allowed_locations: unknown;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  permission_evidence_url: string | null;
  permission_basis: string | null;
  parser_version: string | null;
  fetch_policy: unknown;
  registry_revision: string;
};

export type ApprovedRegistration = {
  source: ApprovedSource;
  registryRevision: string;
};

/** Internal read-only entry point. It never updates permissions or fetches a URL. */
export class MunicipalSourceRegistry {
  constructor(private readonly pool: Pool) {}

  async getApproved(sourceId: string): Promise<ApprovedRegistration | null> {
    if (!sourceIdSchema.safeParse(sourceId).success) return null;

    const result = await this.pool.query<ApprovedRow>(
      `SELECT id, name, kind, lifecycle, access_decision, allowed_locations,
              reviewed_by, reviewed_at, permission_evidence_url, permission_basis,
              parser_version, fetch_policy, registry_revision
         FROM source_catalog
        WHERE id = $1 AND kind = 'municipal_notice'
          AND lifecycle = 'configured' AND access_decision = 'approved'
          AND terms_review = 'reviewed'`,
      [sourceId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const parsed = approvedSourceSchema.safeParse({
      id: row.id,
      name: row.name,
      kind: row.kind,
      enabled: row.lifecycle === "configured",
      locations: row.allowed_locations,
      review: {
        decision: row.access_decision,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at?.toISOString(),
        evidenceUrl: row.permission_evidence_url,
        permissionBasis: row.permission_basis,
      },
      parserVersion: row.parser_version,
      fetchPolicy: row.fetch_policy,
    });
    if (
      !parsed.success ||
      !/^\d+$/.test(row.registry_revision) ||
      BigInt(row.registry_revision) < 1n
    ) {
      throw new Error(`Invalid approved source registration: ${sourceId}`);
    }
    return { source: parsed.data, registryRevision: row.registry_revision };
  }
}
