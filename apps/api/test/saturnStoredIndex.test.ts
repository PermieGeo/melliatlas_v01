// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { SaturnStoredIndex } from "../src/modules/sources/providers/saturn/saturnStoredIndex.js";

it("scopes district previews by both registered-region subject and district ID", async () => {
  const query = vi.fn(async (sql: string, args: unknown[]) => {
    expect(sql).toContain("v.first_request->'filter'->>'subject'=$2");
    expect(sql).toContain("v.district_provider_id=$3");
    expect(args.slice(0, 3)).toEqual(["treatment-feed", "77", 1477]);
    return sql.includes("COUNT(") ? { rows: [{ count: "0" }] } : { rows: [] };
  });
  const index = new SaturnStoredIndex({ query } as unknown as Pool);
  expect(await index.districtPoints("77", 1477)).toEqual({
    centers: [],
    totalKnown: 0,
  });
  expect(query).toHaveBeenCalledTimes(2);
  await expect(index.districtPoints("bad/region", 1477)).rejects.toThrow(
    "Invalid Saturn region code",
  );
});
