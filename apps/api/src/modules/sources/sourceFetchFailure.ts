// Feature IDs: SOURCES.SAFE_FETCH
export type FetchFailureCode =
  | "SOURCE_UNAPPROVED"
  | "DESTINATION_DENIED"
  | "DNS_UNSAFE"
  | "NETWORK_FAILURE"
  | "TIMEOUT"
  | "CANCELLED"
  | "BODY_TOO_LARGE"
  | "MIME_DENIED"
  | "ENCODING_DENIED"
  | "BAD_REDIRECT"
  | "UPSTREAM_STATUS"
  | "BUSY"
  | "RATE_LIMITED";

export class SourceFetchFailure extends Error {
  constructor(readonly code: FetchFailureCode) {
    super(code);
    this.name = "SourceFetchFailure";
  }
}
