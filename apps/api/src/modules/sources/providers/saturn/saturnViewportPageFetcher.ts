// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { ApiFailure } from "../../../../lib/errors.js";
import {
  type RestrictedSourceFetcher,
  SourceFetchFailure,
} from "../../httpFetcher.js";
import type { SaturnProviderPort } from "./SaturnProvider.js";
import { SATURN_JSON_PROFILE_ID } from "./requestProfile.js";
import {
  SATURN_VIEWPORT_PATH,
  SATURN_VIEWPORT_URL,
  saturnJsonSource,
} from "./sourceProfile.js";
import type { SaturnViewportQuery } from "./saturnViewportQuery.js";

type FetchPort = Pick<RestrictedSourceFetcher, "fetch">;

/** Make exactly one source-bound viewport request and validate its page envelope. */
export class SaturnViewportPageFetcher {
  constructor(
    private readonly fetcher: FetchPort,
    private readonly provider: SaturnProviderPort,
  ) {}

  /**
   * Validate the response before returning it for an independent atomic DB write.
   * @throws ApiFailure for upstream transport, JSON or source-schema failures.
   */
  async fetch(
    providerName: string,
    firstPageRequest: SaturnViewportQuery,
    pageNumber: number,
  ): Promise<{ body: unknown; receivedCount: number }> {
    const request = this.provider.pageAt(firstPageRequest, pageNumber);
    try {
      const response = await this.fetcher.fetch(
        saturnJsonSource(providerName, SATURN_VIEWPORT_PATH),
        {
          url: SATURN_VIEWPORT_URL,
          method: "POST",
          body: JSON.stringify(request),
          requestProfile: SATURN_JSON_PROFILE_ID,
        },
      );
      const body = JSON.parse(response.bytes.toString("utf8")) as unknown;
      const receivedCount = this.provider.parsePage(body, request).entries
        .length;
      return { body, receivedCount };
    } catch (error) {
      if (error instanceof SourceFetchFailure) {
        throw new ApiFailure(
          error.code === "RATE_LIMITED" ? 429 : 502,
          error.code === "RATE_LIMITED"
            ? "SOURCE_THROTTLED"
            : "SOURCE_UNAVAILABLE",
          "Unable to retrieve the requested Saturn page",
        );
      }
      throw new ApiFailure(
        502,
        "INVALID_SOURCE_RESPONSE",
        "Saturn returned an invalid map-index page",
      );
    }
  }
}
