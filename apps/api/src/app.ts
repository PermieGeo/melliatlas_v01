// Feature IDs: SOURCES.CATALOG, WEATHER.POINT_FORECAST, SOURCES.SATURN_CONFIGURATION
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  apiErrorSchema,
  saturnConfigurationEditSchema,
  type SaturnConfiguration,
  type SaturnConfigurationEdit,
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
  saturnConfiguration?: {
    get(): Promise<SaturnConfiguration>;
    update(input: SaturnConfigurationEdit): Promise<SaturnConfiguration>;
  };
};

export function createApp(
  services: ApiServices,
  options: { operatorToken?: string } = {},
): express.Express {
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


  // The operator token is supplied only through the backend environment and never returned to browsers.
  const requireOperator: express.RequestHandler = (req, _res, next) => {
    if (!options.operatorToken || !services.saturnConfiguration) {
      return next(new ApiFailure(503, "OPERATOR_UNAVAILABLE", "Operator configuration is unavailable"));
    }
    const authorization = req.header("authorization");
    const supplied = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";
    const digest = (token: string) => createHash("sha256").update(token).digest();
    if (!supplied || !timingSafeEqual(digest(supplied), digest(options.operatorToken))) {
      return next(new ApiFailure(401, "UNAUTHORIZED", "Operator authentication required"));
    }
    next();
  };

  app.get("/api/v1/operator/saturn", requireOperator, async (_req, res, next) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await services.saturnConfiguration!.get());
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/v1/operator/saturn", requireOperator, async (req, res, next) => {
    const parsed = saturnConfigurationEditSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ApiFailure(400, "INVALID_SATURN_CONFIG", "Invalid Saturn configuration"));
    }
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await services.saturnConfiguration!.update(parsed.data));
    } catch (error) {
      next(error);
    }
  });

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
