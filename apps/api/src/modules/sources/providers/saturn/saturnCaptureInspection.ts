// Feature IDs: SOURCES.DOCUMENT_HISTORY
import {
  inspectSaturnAcrEvidence,
  type SaturnAcrEvidence,
} from "./saturnAcrEvidence.js";
import {
  compareSaturnCapturedIdentities,
  type SaturnAcrIdentityCapture,
  type SaturnIdentityComparison,
} from "./saturnEvidenceLinks.js";
import { parseSaturnPolygonJsonp } from "./saturnMapEvidence.js";
import { SaturnCaptureStatus } from "./sourceProfile.js";
import {
  parseSaturnCapturedViewportPage,
  validateSaturnCapturedViewportQuery,
} from "./saturnViewportQuery.js";

export type SaturnCaptureBodies = {
  queryRequest: unknown;
  queryResponse: unknown;
  polygonJsonp: string;
  callback: string;
  acrCaptures?: readonly SaturnAcrIdentityCapture[];
};

export type SaturnCaptureInspection = {
  status: `${SaturnCaptureStatus.IdentityOnly}`;
  selection: {
    subject: string;
    districtId: string;
    updateMapFrom: string | null;
    updateMapTo: string | null;
    pageNumber: number;
    totalPages: number;
    totalElements: number;
    nextPage: number | null;
  };
  counts: {
    indexEntries: number;
    polygons: number;
    clusters: number;
    markers: number;
    uniqueExactGeometries: number;
    acrResponses: number;
  };
  findings: SaturnIdentityComparison;
  acrDetailEvidence: Array<{
    requestedFeatureId: string;
    evidence: SaturnAcrEvidence;
  }>;
  limitations: readonly string[];
};

/**
 * Inspect separately captured Saturn bodies using existing validated parsers.
 * The report exposes IDs and geometry hashes, never source names, raw payloads
 * or polygon coordinates. It cannot authenticate capture origin or timestamps.
 *
 * @throws Error when a capture fails its provider-specific validation.
 */
export function inspectSaturnCaptureBodies(
  captures: SaturnCaptureBodies,
): SaturnCaptureInspection {
  const request = validateSaturnCapturedViewportQuery(captures.queryRequest);
  const page = parseSaturnCapturedViewportPage(captures.queryResponse, request);
  const polygons = parseSaturnPolygonJsonp(
    captures.polygonJsonp,
    captures.callback,
  );
  const acrCaptures = captures.acrCaptures ?? [];
  const findings = compareSaturnCapturedIdentities(
    page.entries,
    polygons,
    acrCaptures,
  );

  return {
    status: SaturnCaptureStatus.IdentityOnly,
    selection: {
      subject: request.filter.subject,
      districtId: request.filter.district,
      updateMapFrom:
        "startDateUpdateMap" in request.filter
          ? request.filter.startDateUpdateMap
          : null,
      updateMapTo:
        "endDateUpdateMap" in request.filter
          ? request.filter.endDateUpdateMap
          : null,
      pageNumber: page.pageNumber,
      totalPages: page.totalPages,
      totalElements: page.totalElements,
      nextPage: page.nextPage,
    },
    counts: {
      indexEntries: page.entries.length,
      polygons: polygons.polygons.length,
      clusters: polygons.clusterCount,
      markers: polygons.markerCount,
      uniqueExactGeometries: polygons.uniqueGeometryCount,
      acrResponses: acrCaptures.length,
    },
    findings,
    acrDetailEvidence: acrCaptures.map(({ requestedFeatureId, response }) => ({
      requestedFeatureId,
      evidence: inspectSaturnAcrEvidence(response),
    })),
    limitations: [
      "Matching feature IDs are investigative candidates, not verified joins.",
      "Three-endpoint candidates require matching field and plan IDs but do not establish a spatial or treatment association.",
      "ACR date and product counts describe a captured body, not a confirmed treatment.",
      "Capture provenance, timestamps, zoom and viewport equivalence are unverified.",
      "UpdateMap dates are not established treatment or application dates.",
      "Absent UpdateMap filters do not establish a bounded historical selection.",
      "One query page and one polygon viewport do not establish district coverage.",
      "Source permissions and redistribution rights require separate verification.",
    ],
  };
}
