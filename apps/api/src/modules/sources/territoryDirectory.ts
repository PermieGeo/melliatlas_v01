// Feature IDs: SOURCES.CATALOG, NOTICES.MAP_OVERLAY
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

type RegisteredDirectory = {
  regions(): Promise<{ regions: Array<{ code: string; name: string }> }>;
  districts(regionCode: string): Promise<{
    districts: Array<{
      id: number;
      name: string;
      latitude: number;
      longitude: number;
    }>;
  }>;
};

/**
 * Adapt the currently registered source directory to a read-only territory API.
 * Opaque IDs are local navigation keys, NOT canonical administrative IDs or boundaries.
 * Replace this adapter when a provider-independent geographic registry is available.
 */
export function createTerritoryDirectory(
  source: RegisteredDirectory,
): TerritoryDirectory {
  return {
    async regions() {
      const current = await source.regions();
      return territoryRegionsResponseSchema.parse({
        regions: current.regions.map(({ code, name }) => ({ id: code, name })),
      });
    },
    async districts(regionId) {
      const registered = await source.regions();
      if (!registered.regions.some((region) => region.code === regionId)) {
        throw new Error("TERRITORY_REGION_NOT_FOUND");
      }
      const current = await source.districts(regionId);
      return territoryDistrictsResponseSchema.parse({
        regionId,
        districts: current.districts.map(
          ({ id, name, latitude, longitude }) => ({
            id: String(id),
            name,
            center: { lat: latitude, lon: longitude },
          }),
        ),
      });
    },
  };
}
