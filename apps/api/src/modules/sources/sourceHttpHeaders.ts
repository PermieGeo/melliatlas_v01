// Feature IDs: SOURCES.SAFE_FETCH

/** Optional first-party metadata supplied by a registered source adapter. */
export interface SourceHeaderMetadata {
  readonly accept?: string;
  readonly acceptLanguage?: string;
  readonly origin?: string;
  readonly referer?: string;
  readonly contentType?: string;
}

/** Construct constrained HTTP headers without credentials or a spoofed identity. */
export function buildSourceRequestHeaders(
  method: "GET" | "POST",
  body: string | undefined,
  metadata?: SourceHeaderMetadata,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept:
      metadata?.accept ??
      "application/json, text/html, text/plain, application/pdf",
    "Accept-Encoding": "identity",
    "User-Agent": "MelliAtlas-SourceFetcher/1.0",
  };
  if (metadata?.acceptLanguage) {
    headers["Accept-Language"] = metadata.acceptLanguage;
  }
  if (metadata?.referer) headers.Referer = metadata.referer;
  if (method === "POST" && metadata?.origin) headers.Origin = metadata.origin;
  if (body !== undefined) {
    headers["Content-Type"] = metadata?.contentType ?? "application/json";
    headers["Content-Length"] = String(Buffer.byteLength(body));
  }
  return headers;
}
