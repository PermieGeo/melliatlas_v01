// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { Router } from "express";
import { z } from "zod";
import {
  viewportCollectionSelectionSchema,
  type ViewportCollectionSelection,
  type ViewportCollectionResult,
  type ViewportCacheHistoryResponse,
  type SaturnDistrictCatalogResponse,
  type SaturnStoredFieldsResponse,
  type SaturnRequestLogResponse,
} from "@melliatlas/contracts";
import { ApiFailure } from "../../lib/errors.js";

export type ViewportCollectionActions = {
  status(
    selection: ViewportCollectionSelection,
  ): Promise<ViewportCollectionResult>;
  fetchNext(
    selection: ViewportCollectionSelection,
    initiator?: "web" | "admin",
  ): Promise<ViewportCollectionResult>;
  history?(): Promise<ViewportCacheHistoryResponse>;
  districts?(): Promise<SaturnDistrictCatalogResponse>;
  refreshDistricts?(
    initiator?: "web" | "admin",
  ): Promise<SaturnDistrictCatalogResponse>;
  storedFields?(hash: string): Promise<SaturnStoredFieldsResponse>;
  requestLog?(): Promise<SaturnRequestLogResponse>;
};

/** Operator-only inspection of persisted fields, provider requests and cache history. */
export function createSaturnViewportOperatorRouter(
  service?: ViewportCollectionActions,
): Router {
  const router = Router();
  router.get("/history", async (_req, res, next) => {
    if (!service?.history)
      return next(
        new ApiFailure(
          503,
          "VIEWPORT_COLLECTION_UNAVAILABLE",
          "Viewport history unavailable",
        ),
      );
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await service.history());
    } catch (error) {
      next(error);
    }
  });
  router.get("/requests", async (_req, res, next) => {
    if (!service?.requestLog)
      return next(
        new ApiFailure(
          503,
          "VIEWPORT_COLLECTION_UNAVAILABLE",
          "Saturn request log unavailable",
        ),
      );
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await service.requestLog());
    } catch (error) {
      next(error);
    }
  });
  router.get("/fields", async (req, res, next) => {
    if (!service?.storedFields)
      return next(
        new ApiFailure(
          503,
          "VIEWPORT_COLLECTION_UNAVAILABLE",
          "Stored fields unavailable",
        ),
      );
    const parsed = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .safeParse(req.query.hash);
    if (!parsed.success)
      return next(
        new ApiFailure(
          400,
          "INVALID_VIEWPORT_KEY",
          "Invalid saved request key",
        ),
      );
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await service.storedFields(parsed.data));
    } catch (error) {
      next(error);
    }
  });
  router.get("/districts", async (_req, res, next) => {
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
      res.json(await service.refreshDistricts("admin"));
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
      const selection = viewportCollectionSelectionSchema.safeParse(req.body);
      if (!selection.success)
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
            ? await service.status(selection.data)
            : await service.fetchNext(selection.data, "admin"),
        );
      } catch (error) {
        next(error);
      }
    });
  }
  return router;
}
