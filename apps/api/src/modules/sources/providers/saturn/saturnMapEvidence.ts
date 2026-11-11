// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  SATURN_MAX_DISTRICT_CATALOG_ENTRIES,
  SATURN_MAX_DISTRICT_NAME_LENGTH,
  SATURN_MAX_GEOMETRY_POSITIONS,
  SATURN_MAX_LATITUDE,
  SATURN_MAX_LONGITUDE,
  SATURN_MAX_POLYGON_FEATURES,
  SATURN_MAX_POLYGONS_PER_MULTIPOLYGON,
  SATURN_MAX_RING_POSITIONS,
  SATURN_MAX_RINGS_PER_POLYGON,
  SATURN_MIN_DISTRICT_NAME_LENGTH,
  SATURN_MIN_LATITUDE,
  SATURN_MIN_LINEAR_RING_POSITIONS,
  SATURN_MIN_LONGITUDE,
  SATURN_MIN_MULTIPOLYGON_POLYGONS,
  SATURN_MIN_POLYGON_RINGS,
  SATURN_POLYGON_JSONP_MAX_BYTES,
} from "./sourceProfile.js";

enum SaturnMapElementType {
  Feature = "Feature",
  FeatureCollection = "FeatureCollection",
  Cluster = "Cluster",
  Point = "Point",
  Polygon = "Polygon",
  MultiPolygon = "MultiPolygon",
}

const MAX_JSONP_CALLBACK_LENGTH = 128;

const districtSchema = z.object({
  id: z.number().int().positive(),
  name: z
    .string()
    .trim()
    .min(SATURN_MIN_DISTRICT_NAME_LENGTH)
    .max(SATURN_MAX_DISTRICT_NAME_LENGTH),
  latitude: z
    .number()
    .finite()
    .min(SATURN_MIN_LATITUDE)
    .max(SATURN_MAX_LATITUDE),
  longitude: z
    .number()
    .finite()
    .min(SATURN_MIN_LONGITUDE)
    .max(SATURN_MAX_LONGITUDE),
});

/** GeoJSON positions use [longitude, latitude], never [latitude, longitude]. */
const coordinateSchema = z.tuple([
  z.number().finite().min(SATURN_MIN_LONGITUDE).max(SATURN_MAX_LONGITUDE),
  z.number().finite().min(SATURN_MIN_LATITUDE).max(SATURN_MAX_LATITUDE),
]);

/**
 * The fourth minimum position closes a triangular ring by repeating its first
 * coordinate. Zod checks length; requireClosedRings checks actual closure.
 * Maximum positions are local memory/CPU guards, not GeoJSON or Saturn limits.
 */
const ringSchema = z
  .array(coordinateSchema)
  .min(SATURN_MIN_LINEAR_RING_POSITIONS)
  .max(SATURN_MAX_RING_POSITIONS);

/** Polygon: first ring is the exterior; remaining rings represent holes. */
const polygonSchema = z.object({
  type: z.literal(SaturnMapElementType.Polygon),
  coordinates: z
    .array(ringSchema)
    .min(SATURN_MIN_POLYGON_RINGS)
    .max(SATURN_MAX_RINGS_PER_POLYGON),
});

/** MultiPolygon: separate polygons, each with its own exterior and optional holes. */
const multiPolygonSchema = z.object({
  type: z.literal(SaturnMapElementType.MultiPolygon),
  coordinates: z
    .array(
      z
        .array(ringSchema)
        .min(SATURN_MIN_POLYGON_RINGS)
        .max(SATURN_MAX_RINGS_PER_POLYGON),
    )
    .min(SATURN_MIN_MULTIPOLYGON_POLYGONS)
    .max(SATURN_MAX_POLYGONS_PER_MULTIPOLYGON),
});
const geometrySchema = z.discriminatedUnion("type", [
  polygonSchema,
  multiPolygonSchema,
]);
const featureSchema = z
  .object({
    type: z.literal(SaturnMapElementType.Feature),
    id: z.string().regex(/^[1-9][0-9]{0,19}$/),
    geometry: geometrySchema,
  })
  .passthrough();
const collectionSchema = z
  .object({
    data: z.object({
      type: z.literal(SaturnMapElementType.FeatureCollection),
      features: z.array(z.unknown()).max(SATURN_MAX_POLYGON_FEATURES),
    }),
  })
  .passthrough();

export type SaturnDistrict = z.infer<typeof districtSchema>;
export type SaturnPolygonGeometry = z.infer<typeof geometrySchema>;
export type SaturnPolygonEvidence = {
  featureId: string;
  geometry: SaturnPolygonGeometry;
  geometrySha256: string;
};
export type SaturnPolygonBatch = {
  polygons: SaturnPolygonEvidence[];
  uniqueGeometryCount: number;
  clusterCount: number;
  markerCount: number;
};

/** Validate a captured district directory; coordinates are centers, not boundaries. */
export function parseSaturnDistrictCatalog(input: unknown): SaturnDistrict[] {
  const districts = z
    .array(districtSchema)
    .max(SATURN_MAX_DISTRICT_CATALOG_ENTRIES)
    .parse(input);
  const ids = new Set<number>();
  for (const district of districts) {
    if (ids.has(district.id)) throw new Error("Duplicate Saturn district ID");
    ids.add(district.id);
  }
  return districts;
}

function ringsOf(geometry: SaturnPolygonGeometry): number[][][][] {
  return geometry.type === SaturnMapElementType.Polygon
    ? [geometry.coordinates]
    : geometry.coordinates;
}

function requireClosedRings(geometry: SaturnPolygonGeometry): void {
  // Shape validation is not topological validation: self-intersections,
  // ring winding and spatial correspondence remain unverified.
  let positions = 0;
  for (const polygon of ringsOf(geometry)) {
    for (const ring of polygon) {
      positions += ring.length;
      if (positions > SATURN_MAX_GEOMETRY_POSITIONS)
        throw new Error("Too many polygon coordinates");
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        throw new Error("Saturn polygon ring is not closed");
      }
    }
  }
}

/**
 * Parse one observed Saturn JSONP viewport response without evaluating JavaScript.
 *
 * Polygon feature IDs identify map entries, not proven treatment-plan IDs.
 * Exact coordinate hashes deduplicate byte-equivalent geometry only; this does
 * not establish topological equality, district coverage, or source rights.
 *
 * @param body - Provider body captured from an already authorized request.
 * @param callback - Exact callback supplied in that request.
 * @returns Valid polygon features and counts of non-polygon map decorations.
 * @throws Error for a malformed, oversized or unexpected response.
 */
export function parseSaturnPolygonJsonp(
  body: string,
  callback: string,
): SaturnPolygonBatch {
  if (
    callback.length > MAX_JSONP_CALLBACK_LENGTH ||
    !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)
  ) {
    throw new Error("Invalid Saturn JSONP callback");
  }
  if (Buffer.byteLength(body, "utf8") > SATURN_POLYGON_JSONP_MAX_BYTES) {
    throw new Error("Saturn JSONP response exceeds the offline limit");
  }
  const trimmed = body.trim();
  const prefix = `${callback}(`;
  if (!trimmed.startsWith(prefix) || !trimmed.endsWith(")")) {
    throw new Error("Unexpected Saturn JSONP envelope");
  }
  const json = trimmed.slice(prefix.length, -1);
  const collection = collectionSchema.parse(JSON.parse(json) as unknown);
  const polygons: SaturnPolygonEvidence[] = [];
  const seenIds = new Set<string>();
  let clusterCount = 0;
  let markerCount = 0;
  for (const candidate of collection.data.features) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      throw new Error("Unexpected Saturn map element");
    }
    const element = candidate as Record<string, unknown>;
    if (element.type === SaturnMapElementType.Cluster) {
      const cluster = z
        .object({
          geometry: z.object({ type: z.literal(SaturnMapElementType.Point) }),
        })
        .parse(element);
      if (cluster.geometry.type === SaturnMapElementType.Point) clusterCount++;
      continue;
    }
    if (element.type !== SaturnMapElementType.Feature) {
      throw new Error("Unexpected Saturn map element type");
    }
    const shape = z
      .object({ geometry: z.object({ type: z.string() }) })
      .parse(element);
    if (shape.geometry.type === SaturnMapElementType.Point) {
      if (
        !z
          .string()
          .regex(/^point_[1-9][0-9]*$/)
          .safeParse(element.id).success
      ) {
        throw new Error("Unexpected Saturn map marker ID");
      }
      markerCount++;
      continue;
    }
    const feature = featureSchema.parse(element);
    if (seenIds.has(feature.id))
      throw new Error("Duplicate Saturn polygon feature ID");
    seenIds.add(feature.id);
    requireClosedRings(feature.geometry);
    polygons.push({
      featureId: feature.id,
      geometry: feature.geometry,
      geometrySha256: createHash("sha256")
        .update(JSON.stringify(feature.geometry))
        .digest("hex"),
    });
  }
  return {
    polygons,
    uniqueGeometryCount: new Set(polygons.map((item) => item.geometrySha256))
      .size,
    clusterCount,
    markerCount,
  };
}
