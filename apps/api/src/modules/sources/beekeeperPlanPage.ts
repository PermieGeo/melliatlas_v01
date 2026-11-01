// Feature IDs: SOURCES.PROVIDER_CONFIGURATION, NOTICES.EXTRACTION
import { z } from "zod";

const coordinate = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]);
const polygon = z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(coordinate).min(4)).min(1) }).passthrough();
const multiPolygon = z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(z.array(coordinate).min(4)).min(1)).min(1) }).passthrough();
const plan = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  beeAcreage: z.object({
    id: z.union([z.string(), z.number()]).optional(),
    planId: z.union([z.string(), z.number()]).optional(),
    contractorName: z.string().optional(),
    cadNum: z.string().optional(),
    planDate: z.number().finite().optional(),
    planDateEnd: z.number().finite().optional(),
    geo: z.union([polygon, multiPolygon]).optional(),
  }).passthrough().optional(),
  allPatList: z.array(z.object({
    patName: z.string().optional(),
    regulationCropName: z.string().optional(),
    patProductDangerClassBee: z.union([z.string(), z.number()]).optional(),
  }).passthrough()).optional(),
}).passthrough();
const pageSchema = z.object({ content: z.array(plan).max(200), totalElements: z.number().int().nonnegative().optional() }).passthrough();

export type BeekeeperPlan = {
  externalId: string | null;
  contractorName: string | null;
  cadastralNumber: string | null;
  startAt: string | null;
  endAt: string | null;
  geometry: z.infer<typeof polygon> | z.infer<typeof multiPolygon> | null;
  treatments: { name: string | null; crop: string | null; beeHazardClass: number | null }[];
};

function unixSeconds(value: number | undefined): string | null {
  if (value === undefined || !Number.isSafeInteger(value) || value <= 0 || value > 253402300799) return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Parse the historical portal shape as unreviewed evidence; do not infer absent values or publish it. */
export function parseBeekeeperPlanPage(input: unknown): { totalElements: number | null; plans: BeekeeperPlan[] } {
  const page = pageSchema.parse(input);
  return {
    totalElements: page.totalElements ?? null,
    plans: page.content.map((record) => {
      const acreage = record.beeAcreage;
      return {
        externalId: String(acreage?.planId ?? acreage?.id ?? record.id ?? "") || null,
        contractorName: acreage?.contractorName?.trim() || null,
        cadastralNumber: acreage?.cadNum?.trim() || null,
        startAt: unixSeconds(acreage?.planDate),
        endAt: unixSeconds(acreage?.planDateEnd),
        geometry: acreage?.geo ?? null,
        treatments: (record.allPatList ?? []).map((item) => ({
          name: item.patName?.trim() || null,
          crop: item.regulationCropName?.trim() || null,
          beeHazardClass: [1, 2, 3].includes(Number(item.patProductDangerClassBee ?? NaN))
            ? Number(item.patProductDangerClassBee) : null,
        })),
      };
    }),
  };
}
