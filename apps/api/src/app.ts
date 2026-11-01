// Feature IDs: SOURCES.CATALOG, WEATHER.POINT_FORECAST, SOURCES.PROVIDER_CONFIGURATION, NOTICES.MAP_OVERLAY
import { randomUUID } from "node:crypto";
import {
  apiErrorSchema,
  providerConfigurationEditSchema,
  type ProviderConfiguration,
  type ProviderConfigurationEdit,
  type ProviderCollectionStatus,
  locationQuerySchema,
  type Coordinates,
  type InspectionResponse,
  type SourceCatalogEntry,
} from "@melliatlas/contracts";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { ApiFailure } from "./lib/errors.js";

export type ApiServices = {
  inspectLocation(point: Coordinates): Promise<InspectionResponse>;
  listSources(): Promise<SourceCatalogEntry[]>;
  checkReadiness(): Promise<boolean>;
  treatmentFeed?: {
    status(): Promise<ProviderCollectionStatus>;
    syncOnePage(): Promise<{
      runId: string;
      pageNumber: number;
      received: number;
      stored: number;
      nextPage: number;
    }>;
    pending(): Promise<
      Array<{
        id: string;
        sourceUrl: string;
        retrievedAt: string;
        contractorName: string | null;
        cadastralNumber: string | null;
        geometryAvailable: boolean;
        startAt: string | null;
        endAt: string | null;
        treatments: Array<{
          name: string | null;
          crop: string | null;
          beeHazardClass: number | null;
        }>;
      }>
    >;
    review(
      id: string,
      decision: "verified" | "rejected",
      reviewer: string,
      evidenceNote: string,
    ): Promise<void>;
    published(bbox?: [number, number, number, number]): Promise<unknown[]>;
    preview(): Promise<unknown[]>;
  };
  providerConfiguration?: {
    get(): Promise<ProviderConfiguration>;
    update(input: ProviderConfigurationEdit): Promise<ProviderConfiguration>;
  };
};

export function createApp(services: ApiServices): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "64kb" }));
  app.use((_req, res, next) => {
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);
    next();
  });
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json(
          apiErrorSchema.parse({
            error: {
              code: "RATE_LIMITED",
              message: "Too many requests",
              requestId: res.locals.requestId as string,
            },
          }),
        );
      },
    }),
  );

  app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
  app.get("/health/ready", async (_req, res) => {
    try {
      const ready = await services.checkReadiness();
      res
        .status(ready ? 200 : 503)
        .json({ status: ready ? "ready" : "unavailable" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.get("/api/v1/sources", async (_req, res, next) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ sources: await services.listSources() });
    } catch (error) {
      next(error);
    }
  });

  // Reject cross-origin browser requests to the local administrator routes.
  app.use("/api/v1/operator", (req, _res, next) => {
    const origin = req.header("origin");
    if (origin) {
      try {
        const url = new URL(origin);
        if (
          url.protocol !== "http:" ||
          !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
          !["5173", "3001"].includes(url.port)
        ) {
          return next(
            new ApiFailure(
              403,
              "FORBIDDEN_ORIGIN",
              "Administrator access is local only",
            ),
          );
        }
      } catch {
        return next(
          new ApiFailure(
            403,
            "FORBIDDEN_ORIGIN",
            "Administrator access is local only",
          ),
        );
      }
    }
    next();
  });

  // Administrator routes are served by the loopback-bound admin application.
  // Network exposure must be controlled at deployment, not with browser-held tokens.
  const requireOperator: express.RequestHandler = (_req, _res, next) => {
    if (!services.providerConfiguration && !services.treatmentFeed) {
      return next(
        new ApiFailure(
          503,
          "OPERATOR_UNAVAILABLE",
          "Administrator functions unavailable",
        ),
      );
    }
    next();
  };

  app.get(
    "/api/v1/operator/provider",
    requireOperator,
    async (_req, res, next) => {
      try {
        res.setHeader("Cache-Control", "no-store");
        res.json(await services.providerConfiguration!.get());
      } catch (error) {
        next(error);
      }
    },
  );

  app.put(
    "/api/v1/operator/provider",
    requireOperator,
    async (req, res, next) => {
      const parsed = providerConfigurationEditSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(
          new ApiFailure(
            400,
            "INVALID_PROVIDER_CONFIG",
            "Invalid provider configuration",
          ),
        );
      }
      try {
        res.setHeader("Cache-Control", "no-store");
        res.json(await services.providerConfiguration!.update(parsed.data));
      } catch (error) {
        next(error);
      }
    },
  );

  app.get("/api/v1/notices", async (req, res, next) => {
    if (!services.treatmentFeed)
      return next(
        new ApiFailure(
          503,
          "NOTICES_UNAVAILABLE",
          "Notice storage unavailable",
        ),
      );
    const bbox = req.query.bbox;
    let bounds: [number, number, number, number] | undefined;
    if (bbox !== undefined) {
      if (
        typeof bbox !== "string" ||
        !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(
          bbox,
        )
      ) {
        return next(
          new ApiFailure(400, "INVALID_BBOX", "Invalid geographic bounds"),
        );
      }
      const [west, south, east, north] = bbox.split(",").map(Number);
      if (
        ![west, south, east, north].every(Number.isFinite) ||
        west < -180 ||
        east > 180 ||
        south < -90 ||
        north > 90 ||
        west >= east ||
        south >= north
      ) {
        return next(
          new ApiFailure(400, "INVALID_BBOX", "Invalid geographic bounds"),
        );
      }
      bounds = [west, south, east, north];
    }
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ notices: await services.treatmentFeed.published(bounds) });
    } catch (error) {
      next(error);
    }
  });

  app.get(
    "/api/v1/operator/notices/map-preview",
    requireOperator,
    async (_req, res, next) => {
      if (!services.treatmentFeed)
        return next(
          new ApiFailure(503, "NOTICES_UNAVAILABLE", "Map preview unavailable"),
        );
      try {
        res.setHeader("Cache-Control", "no-store");
        res.json({ notices: await services.treatmentFeed.preview() });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    "/api/v1/operator/provider/status",
    requireOperator,
    async (_req, res, next) => {
      if (!services.treatmentFeed)
        return next(
          new ApiFailure(503, "NOTICES_UNAVAILABLE", "Ingestion unavailable"),
        );
      try {
        res.setHeader("Cache-Control", "no-store");
        res.json(await services.treatmentFeed.status());
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/v1/operator/provider/sync",
    requireOperator,
    async (_req, res, next) => {
      if (!services.treatmentFeed)
        return next(
          new ApiFailure(503, "NOTICES_UNAVAILABLE", "Ingestion unavailable"),
        );
      try {
        res.setHeader("Cache-Control", "no-store");
        res.json(await services.treatmentFeed.syncOnePage());
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    "/api/v1/operator/notices",
    requireOperator,
    async (_req, res, next) => {
      if (!services.treatmentFeed)
        return next(
          new ApiFailure(503, "NOTICES_UNAVAILABLE", "Review unavailable"),
        );
      try {
        res.setHeader("Cache-Control", "no-store");
        res.json({ notices: await services.treatmentFeed.pending() });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/v1/operator/notices/:id/review",
    requireOperator,
    async (req, res, next) => {
      if (!services.treatmentFeed)
        return next(
          new ApiFailure(503, "NOTICES_UNAVAILABLE", "Review unavailable"),
        );
      if (
        (req.body?.decision !== "verified" &&
          req.body?.decision !== "rejected") ||
        typeof req.body?.reviewer !== "string" ||
        typeof req.body?.evidenceNote !== "string"
      ) {
        return next(
          new ApiFailure(
            400,
            "INVALID_REVIEW",
            "Expected verified or rejected decision",
          ),
        );
      }
      try {
        await services.treatmentFeed.review(
          req.params.id,
          req.body.decision,
          req.body.reviewer,
          req.body.evidenceNote,
        );
        res.setHeader("Cache-Control", "no-store");
        res.json({ status: req.body.decision });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get("/api/v1/locations/inspect", async (req, res, next) => {
    const query = locationQuerySchema.safeParse(req.query);
    if (!query.success) {
      return next(
        new ApiFailure(
          400,
          "INVALID_COORDINATES",
          "Latitude and longitude must be valid WGS84 numbers",
        ),
      );
    }
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await services.inspectLocation(query.data));
    } catch (error) {
      next(error);
    }
  });

  app.use((_req, _res, next) =>
    next(new ApiFailure(404, "NOT_FOUND", "Resource not found")),
  );

  const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next,
  ) => {
    const safe =
      error instanceof ApiFailure
        ? error
        : new ApiFailure(500, "INTERNAL_ERROR", "Internal server error");
    if (!(error instanceof ApiFailure)) {
      console.error("Unclassified API error", {
        requestId: res.locals.requestId,
      });
    }
    res.status(safe.statusCode).json(
      apiErrorSchema.parse({
        error: {
          code: safe.code,
          message: safe.message,
          requestId: res.locals.requestId as string,
        },
      }),
    );
  };
  app.use(errorHandler);
  return app;
}
