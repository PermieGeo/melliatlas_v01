// Feature IDs: NOTICES.MAP_OVERLAY, SOURCES.DOCUMENT_HISTORY

export const DEMO_SOURCE_URL = "https://demo.melliatlas.invalid/plans";
export const DEMO_SOURCE_NAME = "DEMO — SYNTHETIC DATA (NOT SATURN)";
export const DEMO_RETRIEVED_AT = "2026-11-03T09:00:00.000Z";

export type DemoObservation = {
  id: string;
  externalId: string;
  contractorName: string;
  cadastralNumber: string | null;
  startAt: string | null;
  endAt: string | null;
  reviewStatus: "pending" | "verified" | "rejected";
  geometry: { type: "Polygon"; coordinates: number[][][] } | null;
  treatments: {
    name: string | null;
    crop: string | null;
    beeHazardClass: 1 | 2 | 3 | null;
  }[];
};

/** Make fictional rectangular fields; coordinates are illustrative, not cadastral boundaries. */
function rectangle(
  lon: number,
  lat: number,
  width = 0.022,
  height = 0.015,
): NonNullable<DemoObservation["geometry"]> {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lon, lat],
        [lon + width, lat],
        [lon + width, lat + height],
        [lon, lat + height],
        [lon, lat],
      ],
    ],
  };
}

const rows: Array<{
  lon: number;
  lat: number;
  status: DemoObservation["reviewStatus"];
  hazard: 1 | 2 | 3 | null;
  crop: string | null;
  product: string | null;
  date: string | null;
  textOnly?: boolean;
}> = [
  {
    lon: 32.029,
    lat: 54.778,
    status: "verified",
    hazard: 2,
    crop: "Rapeseed (DEMO)",
    product: "DEMO preparation A",
    date: "2026-11-04",
  },
  {
    lon: 32.061,
    lat: 54.794,
    status: "pending",
    hazard: 1,
    crop: "Buckwheat (DEMO)",
    product: "DEMO preparation B",
    date: "2026-11-05",
  },
  {
    lon: 31.997,
    lat: 54.767,
    status: "pending",
    hazard: 3,
    crop: "Clover (DEMO)",
    product: "DEMO preparation C",
    date: "2026-11-06",
  },
  {
    lon: 32.101,
    lat: 54.757,
    status: "verified",
    hazard: null,
    crop: "Rye (DEMO)",
    product: null,
    date: null,
  },
  {
    lon: 31.956,
    lat: 54.816,
    status: "rejected",
    hazard: 1,
    crop: "Barley (DEMO)",
    product: "DEMO preparation D",
    date: "2026-11-07",
  },
  {
    lon: 32.13,
    lat: 54.826,
    status: "pending",
    hazard: 2,
    crop: "Oats (DEMO)",
    product: "DEMO preparation E",
    date: "2026-11-08",
  },
  {
    lon: 31.91,
    lat: 54.733,
    status: "verified",
    hazard: 3,
    crop: "Peas (DEMO)",
    product: "DEMO preparation F",
    date: "2026-11-09",
  },
  {
    lon: 32.18,
    lat: 54.865,
    status: "pending",
    hazard: null,
    crop: null,
    product: null,
    date: null,
  },
  {
    lon: 32.035,
    lat: 54.749,
    status: "pending",
    hazard: 2,
    crop: "Wheat (DEMO)",
    product: "DEMO preparation G",
    date: "2026-11-10",
  },
  {
    lon: 31.976,
    lat: 54.871,
    status: "verified",
    hazard: 1,
    crop: "Rapeseed (DEMO)",
    product: "DEMO preparation H",
    date: "2026-11-11",
  },
  {
    lon: 32.083,
    lat: 54.717,
    status: "pending",
    hazard: null,
    crop: null,
    product: null,
    date: null,
    textOnly: true,
  },
  {
    lon: 32.239,
    lat: 54.804,
    status: "pending",
    hazard: 3,
    crop: "Buckwheat (DEMO)",
    product: "DEMO preparation I",
    date: "2026-11-12",
  },
];

/** Stable, deliberately fictional treatments for a separate local demo database. */
export const DEMO_OBSERVATIONS: DemoObservation[] = rows.map((row, index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    id: `d0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    externalId: `DEMO-PLAN-${number}`,
    contractorName: `DEMO agricultural cooperative ${number}`,
    cadastralNumber: row.textOnly ? null : `DEMO-PARCEL-${number}`,
    startAt: row.date ? `${row.date}T09:00:00.000Z` : null,
    endAt: row.date ? `${row.date}T17:00:00.000Z` : null,
    reviewStatus: row.status,
    geometry: row.textOnly ? null : rectangle(row.lon, row.lat),
    treatments:
      row.product || row.crop || row.hazard
        ? [
            {
              name: row.product,
              crop: row.crop,
              beeHazardClass: row.hazard,
            },
          ]
        : [],
  };
});
