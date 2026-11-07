// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import {
  viewportCollectionSelectionSchema,
  type ViewportCollectionSelection,
  type ViewportCollectionResult,
  type SaturnDistrictCatalogResponse,
  type SaturnDistrictPointsResponse,
} from "@melliatlas/contracts";
import { ApiFailure } from "../../lib/errors.js";

export type ClientViewportActions = {
  status(
    selection: ViewportCollectionSelection,
  ): Promise<ViewportCollectionResult>;
  fetchNext(
    selection: ViewportCollectionSelection,
    initiator?: "web" | "admin",
  ): Promise<ViewportCollectionResult>;
  districts?(): Promise<SaturnDistrictCatalogResponse>;
  refreshDistricts?(
    initiator?: "web" | "admin",
  ): Promise<SaturnDistrictCatalogResponse>;
  districtPoints?(districtId: number): Promise<SaturnDistrictPointsResponse>;
};

/** Local-only diagnostic access; a browser Origin is not a production authentication factor. */
const requireLocalBeekeeper: RequestHandler = (req, _res, next) => {
  const peer = req.socket.remoteAddress;
  const localPeer =
    peer === "127.0.0.1" || peer === "::1" || peer === "::ffff:127.0.0.1";
  const origin = req.header("origin");
  let allowedOrigin = false;
  try {
    if (origin) {
      const url = new URL(origin);
      allowedOrigin =
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
        ["5173", "3001"].includes(url.port);
    }
  } catch {
    allowedOrigin = false;
  }
  if (!localPeer || !allowedOrigin) {
    return next(
      new ApiFailure(
        403,
        "LOCAL_VIEWPORT_ONLY",
        "Local beekeeper browser required",
      ),
    );
  }
  next();
};

/** Only explicit POST actions may contact Saturn; cache inspection is read-only. */
export function createSaturnViewportClientRouter(
  service?: ClientViewportActions,
): Router {
  const router = Router();
  router.use(requireLocalBeekeeper);
  router.post("/districts", async (_req, res, next) => {
    if (!service?.districts)
      return next(
        new ApiFailure(
          503,
          "VIEWPORT_COLLECTION_UNAVAILABLE",
          "District catalog unavailable",
        ),
      );
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await service.districts());
    } catch (error) {
      next(error);
    }
  });
  router.post("/districts/refresh", async (_req, res, next) => {
    if (!service?.refreshDistricts)
      return next(
        new ApiFailure(
          503,
          "VIEWPORT_COLLECTION_UNAVAILABLE",
          "District catalog unavailable",
        ),
      );
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await service.refreshDistricts("web"));
    } catch (error) {
      next(error);
    }
  });
  router.post("/district-points", async (req, res, next) => {
    if (!service?.districtPoints)
      return next(
        new ApiFailure(
          503,
          "VIEWPORT_COLLECTION_UNAVAILABLE",
          "District preview unavailable",
        ),
      );
    const parsed = z
      .object({ districtId: z.number().int().positive().safe() })
      .strict()
      .safeParse(req.body);
    if (!parsed.success)
      return next(
        new ApiFailure(
          400,
          "INVALID_VIEWPORT_SELECTION",
          "Invalid district ID",
        ),
      );
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await service.districtPoints(parsed.data.districtId));
    } catch (error) {
      next(error);
    }
  });
  for (const action of ["status", "next"] as const) {
    router.post(`/${action}`, async (req, res, next) => {
      if (!service)
        return next(
          new ApiFailure(
            503,
            "VIEWPORT_COLLECTION_UNAVAILABLE",
            "Viewport collection unavailable",
          ),
        );
      const parsed = viewportCollectionSelectionSchema.safeParse(req.body);
      if (!parsed.success)
        return next(
          new ApiFailure(
            400,
            "INVALID_VIEWPORT_SELECTION",
            "Invalid bounded viewport selection",
          ),
        );
      try {
        res.setHeader("Cache-Control", "no-store");
        res.json(
          action === "status"
            ? await service.status(parsed.data)
            : await service.fetchNext(parsed.data, "web"),
        );
      } catch (error) {
        next(error);
      }
    });
  }
  return router;
}
