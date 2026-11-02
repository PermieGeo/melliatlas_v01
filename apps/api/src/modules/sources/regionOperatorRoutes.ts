// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { Router } from "express";
import { ApiFailure } from "../../lib/errors.js";
import type { RegionCollectionStatus } from "./regionalCollection.js";

export type RegionCollectionActions = {
  status(): Promise<RegionCollectionStatus>;
  start(): Promise<RegionCollectionStatus>;
  pause(): Promise<RegionCollectionStatus>;
};

/** HTTP adapter only; the application supplies the local administrator boundary. */
export function createRegionOperatorRouter(
  service?: RegionCollectionActions,
): Router {
  const router = Router();
  const unavailable = () =>
    new ApiFailure(
      503,
      "REGION_SCAN_UNAVAILABLE",
      "Regional collection unavailable",
    );
  router.get("/", async (_req, res, next) => {
    if (!service) return next(unavailable());
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await service.status());
    } catch (error) {
      next(error);
    }
  });
  router.post("/start", async (_req, res, next) => {
    if (!service) return next(unavailable());
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await service.start());
    } catch (error) {
      next(error);
    }
  });
  router.post("/pause", async (_req, res, next) => {
    if (!service) return next(unavailable());
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await service.pause());
    } catch (error) {
      next(error);
    }
  });
  return router;
}
