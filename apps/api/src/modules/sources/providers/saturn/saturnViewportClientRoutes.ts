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
import { ApiFailure } from "../../../../lib/errors.js";
import {
  SaturnRequestInitiator,
  SaturnViewportRouteAction,
} from "./sourceProfile.js";

const LOCAL_BEEKEEPER_PEERS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOCAL_BEEKEEPER_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const LOCAL_BEEKEEPER_PORTS = new Set(["5173", "3001"]);

export type ClientViewportActions = {
  status(
    selection: ViewportCollectionSelection,
  ): Promise<ViewportCollectionResult>;
  fetchNext(
    selection: ViewportCollectionSelection,
    initiator?: `${SaturnRequestInitiator}`,
  ): Promise<ViewportCollectionResult>;
  districts?(): Promise<SaturnDistrictCatalogResponse>;
  refreshDistricts?(
    initiator?: `${SaturnRequestInitiator}`,
  ): Promise<SaturnDistrictCatalogResponse>;
  districtPoints?(districtId: number): Promise<SaturnDistrictPointsResponse>;
};

/** Local-only diagnostic access; a browser Origin is not a production authentication factor. */
const requireLocalBeekeeper: RequestHandler = (req, _res, next) => {
  const peer = req.socket.remoteAddress;
  const localPeer = peer !== undefined && LOCAL_BEEKEEPER_PEERS.has(peer);
  const origin = req.header("origin");
  let allowedOrigin = false;
  try {
    if (origin) {
      const url = new URL(origin);
      allowedOrigin =
        url.protocol === "http:" &&
        LOCAL_BEEKEEPER_HOSTS.has(url.hostname) &&
        LOCAL_BEEKEEPER_PORTS.has(url.port);
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
      res.json(await service.refreshDistricts(SaturnRequestInitiator.Web));
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
  for (const action of [
    SaturnViewportRouteAction.Status,
    SaturnViewportRouteAction.Next,
  ]) {
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
          action === SaturnViewportRouteAction.Status
            ? await service.status(parsed.data)
            : await service.fetchNext(parsed.data, SaturnRequestInitiator.Web),
        );
      } catch (error) {
        next(error);
      }
    });
  }
  return router;
}
