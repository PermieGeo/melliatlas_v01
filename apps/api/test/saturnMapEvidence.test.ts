// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it } from "vitest";
import {
  parseSaturnDistrictCatalog,
  parseSaturnPolygonJsonp,
} from "../src/modules/sources/providers/saturn/saturnMapEvidence.js";

const callback = "id_179398920866287088800";
const geometry = {
  type: "Polygon",
  coordinates: [
    [
      [31.02, 54.93],
      [31.03, 54.93],
      [31.03, 54.94],
      [31.02, 54.93],
    ],
  ],
};
const secondGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [31.1, 55.0],
      [31.11, 55.0],
      [31.11, 55.01],
      [31.1, 55.0],
    ],
  ],
};
function jsonp(features: unknown[]): string {
  return `${callback}(${JSON.stringify({ data: { type: "FeatureCollection", features } })})`;
}
function polygon(id: string, shape: unknown = geometry): unknown {
  return {
    type: "Feature",
    id,
    geometry: shape,
    properties: { balloonContent: "<script>not executed</script>" },
    options: { fillColor: "#2BA040" },
  };
}

describe("captured Saturn spatial reference contracts", () => {
  it("keeps provider district identifiers and centers without inventing borders", () => {
    const result = parseSaturnDistrictCatalog([
      {
        id: 1477,
        name: "Ярцевский муниципальный район",
        latitude: 55.06,
        longitude: 32.68,
      },
      { id: 2670, name: "город Смоленск", latitude: 54.79, longitude: 32.05 },
    ]);
    expect(result.map((item) => item.id)).toEqual([1477, 2670]);
    expect(result[0]).not.toHaveProperty("geometry");
    expect(result[0]).toMatchObject({ name: "Ярцевский муниципальный район" });
  });

  it("rejects duplicate districts, malformed centers and arbitrary collections", () => {
    const original = {
      id: 1477,
      name: "District",
      latitude: 55,
      longitude: 32,
    };
    expect(() => parseSaturnDistrictCatalog([original, original])).toThrow();
    expect(() =>
      parseSaturnDistrictCatalog([{ ...original, latitude: 100 }]),
    ).toThrow();
    expect(() => parseSaturnDistrictCatalog({ content: [original] })).toThrow();
  });

  it("accepts geographic coordinate boundaries and rejects out-of-range district values", () => {
    const district = {
      id: 1477,
      name: "D".repeat(250),
      latitude: 90,
      longitude: -180,
    };
    expect(parseSaturnDistrictCatalog([district])).toEqual([district]);
    expect(
      parseSaturnDistrictCatalog([
        { ...district, latitude: -90, longitude: 180 },
      ]),
    ).toHaveLength(1);
    expect(() =>
      parseSaturnDistrictCatalog([{ ...district, name: "D".repeat(251) }]),
    ).toThrow();
    expect(() =>
      parseSaturnDistrictCatalog([{ ...district, latitude: -90.01 }]),
    ).toThrow();
    expect(() =>
      parseSaturnDistrictCatalog([{ ...district, longitude: 180.01 }]),
    ).toThrow();
  });

  it("preserves map IDs and deduplicates only identical polygons, not plans", () => {
    const batch = parseSaturnPolygonJsonp(
      jsonp([
        polygon("238001"),
        polygon("238194"),
        polygon("2712972", secondGeometry),
        {
          type: "Feature",
          id: "point_2712972",
          geometry: { type: "Point", coordinates: [31, 55] },
        },
        {
          type: "Cluster",
          id: "-123",
          number: 3,
          geometry: { type: "Point", coordinates: [31, 55] },
        },
      ]),
      callback,
    );
    expect(batch.polygons.map((item) => item.featureId)).toEqual([
      "238001",
      "238194",
      "2712972",
    ]);
    expect(batch.uniqueGeometryCount).toBe(2);
    expect(batch.clusterCount).toBe(1);
    expect(batch.markerCount).toBe(1);
    expect(batch.polygons[0].geometrySha256).toBe(
      batch.polygons[1].geometrySha256,
    );
    expect(batch.polygons[0].geometrySha256).not.toBe(
      batch.polygons[2].geometrySha256,
    );
    expect(batch.polygons[0].geometry.coordinates).toEqual(
      geometry.coordinates,
    );
    expect(batch.polygons[0]).not.toHaveProperty("planId");
  });

  it("retains valid multipolygons without inferring topological equivalence", () => {
    const multi = {
      type: "MultiPolygon",
      coordinates: [geometry.coordinates, secondGeometry.coordinates],
    };
    const batch = parseSaturnPolygonJsonp(
      jsonp([polygon("9", multi)]),
      callback,
    );
    expect(batch.polygons[0].geometry.type).toBe("MultiPolygon");
    expect(batch.uniqueGeometryCount).toBe(1);
    expect(batch.polygons[0]).not.toHaveProperty("properties");
    expect(batch.polygons[0]).not.toHaveProperty("options");
  });

  it("enforces the GeoJSON four-position closed-ring minimum", () => {
    const ring = geometry.coordinates[0];
    expect(
      parseSaturnPolygonJsonp(jsonp([polygon("1")]), callback).polygons,
    ).toHaveLength(1);
    expect(() =>
      parseSaturnPolygonJsonp(
        jsonp([
          polygon("1", { type: "Polygon", coordinates: [ring.slice(0, 3)] }),
        ]),
        callback,
      ),
    ).toThrow();
    expect(() =>
      parseSaturnPolygonJsonp(
        jsonp([
          polygon("1", {
            type: "Polygon",
            coordinates: [[...ring.slice(0, 3), [31.9, 55.9]]],
          }),
        ]),
        callback,
      ),
    ).toThrow("Saturn polygon ring is not closed");
  });

  it("keeps independent limits for rings per polygon and polygons per multipolygon", () => {
    const ring = geometry.coordinates[0];
    const polygonAtLimit = {
      type: "Polygon",
      coordinates: Array(100).fill(ring),
    };
    expect(
      parseSaturnPolygonJsonp(jsonp([polygon("1", polygonAtLimit)]), callback)
        .polygons,
    ).toHaveLength(1);
    expect(() =>
      parseSaturnPolygonJsonp(
        jsonp([
          polygon("1", {
            ...polygonAtLimit,
            coordinates: Array(101).fill(ring),
          }),
        ]),
        callback,
      ),
    ).toThrow();

    const multiPolygonAtLimit = {
      type: "MultiPolygon",
      coordinates: Array(100).fill([ring]),
    };
    expect(
      parseSaturnPolygonJsonp(
        jsonp([polygon("2", multiPolygonAtLimit)]),
        callback,
      ).polygons,
    ).toHaveLength(1);
    expect(() =>
      parseSaturnPolygonJsonp(
        jsonp([
          polygon("2", {
            ...multiPolygonAtLimit,
            coordinates: Array(101).fill([ring]),
          }),
        ]),
        callback,
      ),
    ).toThrow();
  });

  it("bounds coordinates per ring and per geometry independently", () => {
    const ringAtLimit = [[31, 55], ...Array(19_998).fill([32, 56]), [31, 55]];
    expect(
      parseSaturnPolygonJsonp(
        jsonp([polygon("1", { type: "Polygon", coordinates: [ringAtLimit] })]),
        callback,
      ).polygons,
    ).toHaveLength(1);
    expect(() =>
      parseSaturnPolygonJsonp(
        jsonp([
          polygon("1", {
            type: "Polygon",
            coordinates: [[...ringAtLimit, [31, 55]]],
          }),
        ]),
        callback,
      ),
    ).toThrow();
    expect(() =>
      parseSaturnPolygonJsonp(
        jsonp([
          polygon("1", {
            type: "Polygon",
            coordinates: Array(3).fill(ringAtLimit),
          }),
        ]),
        callback,
      ),
    ).toThrow("Too many polygon coordinates");
  });

  it("never executes JSONP scripts or accepts the wrong callback", () => {
    expect(() =>
      parseSaturnPolygonJsonp(jsonp([]), "anotherCallback"),
    ).toThrow();
    expect(() =>
      parseSaturnPolygonJsonp(jsonp([]), "callback;alert(1)"),
    ).toThrow();
    expect(() =>
      parseSaturnPolygonJsonp(`${jsonp([])};alert(1)`, callback),
    ).toThrow();
    expect(() => parseSaturnPolygonJsonp("not JSONP", callback)).toThrow();
    expect(() => parseSaturnPolygonJsonp(jsonp([null]), callback)).toThrow();
  });

  it("refuses invalid polygon IDs, rings, coordinates and duplicate feature IDs", () => {
    expect(() =>
      parseSaturnPolygonJsonp(jsonp([polygon("point_1")]), callback),
    ).toThrow();
    expect(() =>
      parseSaturnPolygonJsonp(
        jsonp([
          polygon("5", {
            type: "Polygon",
            coordinates: [
              [
                [31, 55],
                [32, 55],
                [32, 56],
                [31, 56],
              ],
            ],
          }),
        ]),
        callback,
      ),
    ).toThrow();
    expect(() =>
      parseSaturnPolygonJsonp(
        jsonp([
          polygon("5", {
            type: "Polygon",
            coordinates: [
              [
                [181, 55],
                [32, 55],
                [32, 56],
                [181, 55],
              ],
            ],
          }),
        ]),
        callback,
      ),
    ).toThrow();
    expect(() =>
      parseSaturnPolygonJsonp(jsonp([polygon("5"), polygon("5")]), callback),
    ).toThrow();
  });

  it("rejects oversized and structurally unexpected captures", () => {
    expect(() =>
      parseSaturnPolygonJsonp("x".repeat(8 * 1024 * 1024 + 1), callback),
    ).toThrow("Saturn JSONP response exceeds the offline limit");
    expect(() =>
      parseSaturnPolygonJsonp(
        jsonp([
          {
            type: "Unknown",
            id: "1",
            geometry: { type: "Point" },
          },
        ]),
        callback,
      ),
    ).toThrow();
  });
});
