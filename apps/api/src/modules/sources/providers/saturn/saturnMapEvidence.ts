// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";
import { z } from "zod";

const districtSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(250),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

const coordinateSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const ringSchema = z.array(coordinateSchema).min(4).max(20_000);
const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(ringSchema).min(1).max(100),
});
const multiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(ringSchema).min(1).max(100)).min(1).max(100),
});
const geometrySchema = z.discriminatedUnion("type", [
  polygonSchema,
  multiPolygonSchema,
]);
const featureSchema = z
  .object({
    type: z.literal("Feature"),
    id: z.string().regex(/^[1-9][0-9]{0,19}$/),
    geometry: geometrySchema,
  })
  .passthrough();
const collectionSchema = z
  .object({
    data: z.object({
      type: z.literal("FeatureCollection"),
      features: z.array(z.unknown()).max(2_000),
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
  const districts = z.array(districtSchema).max(256).parse(input);
  const ids = new Set<number>();
  for (const district of districts) {
    if (ids.has(district.id)) throw new Error("Duplicate Saturn district ID");
    ids.add(district.id);
  }
  return districts;
}

function ringsOf(geometry: SaturnPolygonGeometry): number[][][][] {
  return geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates;
}

function requireClosedRings(geometry: SaturnPolygonGeometry): void {
  let vertices = 0;
  for (const polygon of ringsOf(geometry)) {
    for (const ring of polygon) {
      vertices += ring.length;
      if (vertices > 50_000) throw new Error("Too many polygon coordinates");
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
  if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(callback)) {
    throw new Error("Invalid Saturn JSONP callback");
  }
  if (Buffer.byteLength(body, "utf8") > 8 * 1024 * 1024) {
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
    if (element.type === "Cluster") {
      const cluster = z
        .object({ geometry: z.object({ type: z.literal("Point") }) })
        .parse(element);
      if (cluster.geometry.type === "Point") clusterCount++;
      continue;
    }
    if (element.type !== "Feature") {
      throw new Error("Unexpected Saturn map element type");
    }
    const shape = z
      .object({ geometry: z.object({ type: z.string() }) })
      .parse(element);
    if (shape.geometry.type === "Point") {
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
