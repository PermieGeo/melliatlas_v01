// Feature IDs: SOURCES.CATALOG, NOTICES.MAP_OVERLAY
import type { Pool } from "pg";
import {
  territoryDistrictsResponseSchema,
  territoryRegionsResponseSchema,
  type TerritoryDistrictsResponse,
  type TerritoryRegionsResponse,
} from "@melliatlas/contracts";

export interface TerritoryDirectory {
  regions(): Promise<TerritoryRegionsResponse>;
  districts(regionId: string): Promise<TerritoryDistrictsResponse>;
}

export type SavedDistrictCenter = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};

/**
 * Read a local navigation registry. The provider mapping is private and the
 * callback reads only a previously persisted catalog; neither call may fetch upstream.
 */
export function createTerritoryDirectory(
  db: Pick<Pool, "query">,
  readCachedDistricts: (
    providerKey: string,
    externalCode: string,
  ) => Promise<SavedDistrictCenter[]>,
): TerritoryDirectory {
  return {
    async regions() {
      const result = await db.query<{ id: string; name: string }>(
        `SELECT id, display_name AS name FROM territory_regions ORDER BY display_name, id LIMIT 256`,
      );
      return territoryRegionsResponseSchema.parse({ regions: result.rows });
    },
    async districts(regionId) {
      const result = await db.query<{
        provider_key: string | null;
        external_code: string | null;
      }>(
        `SELECT mapping.provider_key, mapping.external_code
           FROM territory_regions AS region
           LEFT JOIN territory_region_source_codes AS mapping ON mapping.region_id = region.id
          WHERE region.id = $1
          ORDER BY mapping.provider_key LIMIT 1`,
        [regionId],
      );
      if (result.rows.length === 0)
        throw new Error("TERRITORY_REGION_NOT_FOUND");
      const mapping = result.rows[0];
      const saved =
        mapping.provider_key && mapping.external_code
          ? await readCachedDistricts(
              mapping.provider_key,
              mapping.external_code,
            )
          : [];
      return territoryDistrictsResponseSchema.parse({
        regionId,
        districts: saved.map(({ id, name, latitude, longitude }) => ({
          id: String(id),
          name,
          center: { lat: latitude, lon: longitude },
        })),
      });
    },
  };
}
