// Feature IDs: SOURCES.CATALOG, NOTICES.MAP_OVERLAY
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { SaturnDistrictDirectory } from "../src/modules/sources/providers/saturn/saturnDistrictDirectory.js";
import { createTerritoryDirectory } from "../src/modules/sources/territoryDirectory.js";

let rootPool: Pool;
let pool: Pool;
let schema: string;

describe("provider-independent pilot region migration", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
    schema = `territory_${randomBytes(6).toString("hex")}`;
    rootPool = new Pool({ connectionString: process.env.DATABASE_URL });
    await rootPool.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema},public`,
    });
    for (const migration of [
      "001_source_core.sql",
      "002_source_access_registry.sql",
      "003_saturn_api_configuration.sql",
      "014_saturn_viewport_index.sql",
      "015_saturn_directory_and_request_log.sql",
      "016_saturn_registered_regions.sql",
      "017_territory_regions.sql",
    ]) {
      await pool.query(
        await readFile(
          new URL(`../migrations/${migration}`, import.meta.url),
          "utf8",
        ),
      );
    }
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (rootPool) {
      await rootPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await rootPool.end();
    }
  });

  it("initializes a local pilot region without an operator seed or provider lookup", async () => {
    const lookup = async (providerKey: string, sourceCode: string) => {
      expect(providerKey).toBe("saturn");
      const source = new SaturnDistrictDirectory(pool, false);
      return (await source.list(sourceCode)).districts;
    };
    const directory = createTerritoryDirectory(pool, lookup);
    expect(await directory.regions()).toEqual({
      regions: [{ id: "ru-smolensk", name: "Смоленская область" }],
    });
    expect(await directory.districts("ru-smolensk")).toEqual({
      regionId: "ru-smolensk",
      districts: [],
    });
    const registration = await pool.query(
      "SELECT subject_code FROM source_saturn_regions WHERE subject_code='55'",
    );
    expect(registration.rows).toHaveLength(1);
    await expect(directory.districts("unknown")).rejects.toThrow(
      "TERRITORY_REGION_NOT_FOUND",
    );
  });

  it("reads persisted districts through the private mapping without changing the public region ID", async () => {
    await pool.query(
      `INSERT INTO source_catalog (id,name,kind,lifecycle,url,api_request_config)
       VALUES ('treatment-feed','Fixture','treatment','configured',
       'https://bee-saturn.ru/backend/beemaster/planapplybees',
       '{"endpoint":"https://bee-saturn.ru/backend/beemaster/planapplybees"}'::jsonb)`,
    );
    await pool.query(
      `INSERT INTO source_saturn_district_catalog
       (source_id, source_revision, subject_code, catalog, catalog_sha256)
       VALUES ('treatment-feed','1','55',
         '[{"id":1477,"name":"Test district","latitude":55.06,"longitude":32.68}]'::jsonb,
         repeat('a',64))`,
    );
    const source = new SaturnDistrictDirectory(pool, false);
    const directory = createTerritoryDirectory(
      pool,
      async (provider, regionCode) => {
        expect(provider).toBe("saturn");
        return (await source.list(regionCode)).districts;
      },
    );
    expect(await directory.districts("ru-smolensk")).toEqual({
      regionId: "ru-smolensk",
      districts: [
        {
          id: "1477",
          name: "Test district",
          center: { lat: 55.06, lon: 32.68 },
        },
      ],
    });
    const mapping = await pool.query(
      "SELECT external_code FROM territory_region_source_codes WHERE region_id='ru-smolensk' AND provider_key='saturn'",
    );
    expect(mapping.rows[0].external_code).toBe("55");
  });
});
