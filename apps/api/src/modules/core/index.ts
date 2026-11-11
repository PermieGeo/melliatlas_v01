import {
  inspectionResponseSchema,
  type Coordinates,
  type InspectionResponse,
} from "@melliatlas/contracts";
import type { OpenMeteoAdapter } from "../weather/openMeteo.js";
import type { SaturnViewportCollectionService } from "../sources/providers/saturn/index.js";
import {
  createCoreProviderRegistry,
  WEATHER_PROVIDER_ID,
} from "./providerAdapters.js";

export {
  AnalysisGraph,
  type AnalysisNode,
  type WorkerKind,
} from "./analysisGraph.js";
export {
  InformationProviderRegistry,
  type InformationProvider,
  type InformationProviderDescriptor,
} from "./informationProviders.js";
export {
  createCoreProviderRegistry,
  SATURN_CACHE_PROVIDER_ID,
  WEATHER_PROVIDER_ID,
} from "./providerAdapters.js";

/** Minimal backend composition; provider access is never exposed as a public RPC. */
export function createCore(dependencies: {
  weather: Pick<OpenMeteoAdapter, "inspect">;
  saturn: Pick<SaturnViewportCollectionService, "status">;
}): {
  providers: ReturnType<typeof createCoreProviderRegistry>;
  inspectWeather(point: Coordinates): Promise<InspectionResponse>;
} {
  const providers = createCoreProviderRegistry(dependencies);
  return {
    providers,
    inspectWeather: async (point) =>
      inspectionResponseSchema.parse(
        (await providers.read(WEATHER_PROVIDER_ID, point)).data,
      ),
  };
}
