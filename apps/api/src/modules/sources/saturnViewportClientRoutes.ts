// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { Router, type RequestHandler } from "express";
import {
  viewportCollectionSelectionSchema,
  type ViewportCollectionSelection,
  type ViewportCollectionResult,
} from "@melliatlas/contracts";
import { ApiFailure } from "../../lib/errors.js";

export type ClientViewportActions = {
  status(
    selection: ViewportCollectionSelection,
  ): Promise<ViewportCollectionResult>;
  fetchNext(
    selection: ViewportCollectionSelection,
  ): Promise<ViewportCollectionResult>;
};

/** Constrain source-triggering requests to the local beekeeper UI pilot, not public deployment. */
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

/** Explicit, one-page client workflow; ordinary public map GET requests remain read-only. */
export function createSaturnViewportClientRouter(
  service?: ClientViewportActions,
): Router {
  const router = Router();
  router.use(requireLocalBeekeeper);
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
      const parsed = viewportCollectionSelectionSchema.safeParse(req.body);
      if (!parsed.success) {
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
        res.json(await service[action](parsed.data));
      } catch (error) {
        next(error);
      }
    });
  }
  return router;
}
