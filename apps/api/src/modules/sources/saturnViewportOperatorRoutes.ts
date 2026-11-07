// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { Router } from "express";
import {
  viewportCollectionSelectionSchema,
  type ViewportCollectionSelection,
  type ViewportCollectionResult,
} from "@melliatlas/contracts";
import { ApiFailure } from "../../lib/errors.js";

export type ViewportCollectionActions = {
  status(
    selection: ViewportCollectionSelection,
  ): Promise<ViewportCollectionResult>;
  fetchNext(
    selection: ViewportCollectionSelection,
  ): Promise<ViewportCollectionResult>;
};

/** Local operator boundary for one-page bounded Saturn map-index collection. */
export function createSaturnViewportOperatorRouter(
  service?: ViewportCollectionActions,
): Router {
  const router = Router();
  for (const [path, action] of [
    ["status", "status"],
    ["next", "fetchNext"],
  ] as const) {
    router.post(`/${path}`, async (req, res, next) => {
      if (!service) {
        return next(
          new ApiFailure(
            503,
            "VIEWPORT_COLLECTION_UNAVAILABLE",
            "Viewport collection unavailable",
          ),
        );
      }
      const selection = viewportCollectionSelectionSchema.safeParse(req.body);
      if (!selection.success) {
        return next(
          new ApiFailure(
            400,
            "INVALID_VIEWPORT_SELECTION",
            "Invalid bounded viewport selection",
          ),
        );
      }
      try {
        res.setHeader("Cache-Control", "no-store");
        res.json(await service[action](selection.data));
      } catch (error) {
        next(error);
      }
    });
  }
  return router;
}
