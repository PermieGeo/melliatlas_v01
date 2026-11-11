import {
  coordinatesSchema,
  inspectionResponseSchema,
  viewportCollectionResultSchema,
  viewportCollectionSelectionSchema,
} from "@melliatlas/contracts";
import type { OpenMeteoAdapter } from "../weather/openMeteo.js";
import type { SaturnViewportCollectionService } from "../sources/providers/saturn/index.js";
import { InformationProviderRegistry } from "./informationProviders.js";

export const WEATHER_PROVIDER_ID = "open-meteo";
export const SATURN_CACHE_PROVIDER_ID = "saturn-viewport-cache";

/** Existing source modules retain their own transport, policy, and persistence. */
export function createCoreProviderRegistry(dependencies: {
  weather: Pick<OpenMeteoAdapter, "inspect">;
  saturn: Pick<SaturnViewportCollectionService, "status">;
}): InformationProviderRegistry {
  const registry = new InformationProviderRegistry();
  registry.register({
    descriptor: {
      id: WEATHER_PROVIDER_ID,
      capability: "weather.point_forecast",
    },
    inputSchema: coordinatesSchema,
    outputSchema: inspectionResponseSchema,
    read: (point) => dependencies.weather.inspect(point),
  });
  registry.register({
    descriptor: {
      id: SATURN_CACHE_PROVIDER_ID,
      capability: "treatment.viewport_index_cache",
    },
    inputSchema: viewportCollectionSelectionSchema,
    outputSchema: viewportCollectionResultSchema,
    read: (selection) => dependencies.saturn.status(selection),
  });
  return registry;
}
