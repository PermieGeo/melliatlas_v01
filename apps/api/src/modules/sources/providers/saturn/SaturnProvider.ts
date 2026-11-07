// Feature IDs: SOURCES.DOCUMENT_HISTORY
import {
  viewportCollectionSelectionSchema,
  type ViewportCollectionSelection,
} from "@melliatlas/contracts";
import type {
  DistrictDirectoryProvider,
  ViewportIndexProvider,
} from "../../providerPorts.js";
import {
  parseSaturnDistrictCatalog,
  type SaturnDistrict,
} from "./saturnMapEvidence.js";
import { SATURN_JSON_REQUEST_PROFILE } from "./requestProfile.js";
import {
  SATURN_SOURCE_ID,
  SATURN_SUBJECT_CODE,
  SATURN_VIEWPORT_PAGE_SIZE,
} from "./sourceProfile.js";
import {
  parseSaturnViewportPage,
  validateSaturnViewportQuery,
  type SaturnViewportPage,
  type SaturnViewportQuery,
} from "./saturnViewportQuery.js";

export type SaturnProviderPort = ViewportIndexProvider<
  ViewportCollectionSelection,
  SaturnViewportQuery,
  SaturnViewportPage
> &
  DistrictDirectoryProvider<SaturnDistrict>;

/**
 * Construct only the observed map-index filter; UpdateMap dates are not
 * application dates and this request cannot establish district coverage.
 */
export function makeViewportFirstRequest(
  selection: ViewportCollectionSelection,
): SaturnViewportQuery {
  const parsed = viewportCollectionSelectionSchema.parse(selection);
  return validateSaturnViewportQuery({
    filter: {
      leftTop: { longitude: parsed.bbox.west, latitude: parsed.bbox.north },
      rightDown: { longitude: parsed.bbox.east, latitude: parsed.bbox.south },
      subject: SATURN_SUBJECT_CODE,
      district: String(parsed.districtId),
      startDateUpdateMap: `${parsed.fromDate}T00:00:00.000Z`,
      endDateUpdateMap: `${parsed.toDate}T00:00:00.000Z`,
      culture: [],
      classesDangerBee: [],
      classesDangerMan: [],
      query: null,
    },
    pageNumber: 0,
    pageSize: SATURN_VIEWPORT_PAGE_SIZE,
  });
}

/** Saturn-specific request construction and response validation, with no I/O. */
export class SaturnProvider implements SaturnProviderPort {
  readonly sourceId = SATURN_SOURCE_ID;
  readonly requestProfiles = [SATURN_JSON_REQUEST_PROFILE] as const;

  firstPage(selection: ViewportCollectionSelection): SaturnViewportQuery {
    return makeViewportFirstRequest(selection);
  }

  pageAt(
    firstPage: SaturnViewportQuery,
    pageNumber: number,
  ): SaturnViewportQuery {
    return validateSaturnViewportQuery({ ...firstPage, pageNumber });
  }

  parsePage(
    payload: unknown,
    request: SaturnViewportQuery,
  ): SaturnViewportPage {
    return parseSaturnViewportPage(payload, request);
  }

  parseDirectory(payload: unknown): readonly SaturnDistrict[] {
    return parseSaturnDistrictCatalog(payload);
  }
}
