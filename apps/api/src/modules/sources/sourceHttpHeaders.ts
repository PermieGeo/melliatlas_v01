// Feature IDs: SOURCES.SAFE_FETCH

/** Construct consistent HTTP headers without impersonating a browser identity. */
export function buildSourceRequestHeaders(
  method: "GET" | "POST",
  body: string | undefined,
  profile?: "saturn-json",
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json, text/html, text/plain, application/pdf",
    "Accept-Encoding": "identity",
    "User-Agent": "MelliAtlas-SourceFetcher/1.0",
  };
  if (profile === "saturn-json") {
    headers.Accept = "application/json, text/plain, */*";
    headers["Accept-Language"] = "ru-RU,ru;q=0.9,en;q=0.5";
    // Use a fixed, first-party context only for the two allowlisted Saturn endpoints.
    headers.Referer = "https://bee-saturn.ru/";
    if (method === "POST") headers.Origin = "https://bee-saturn.ru";
  }
  if (body !== undefined) {
    headers["Content-Type"] =
      profile === "saturn-json"
        ? "application/json;charset=UTF-8"
        : "application/json";
    headers["Content-Length"] = String(Buffer.byteLength(body));
  }
  return headers;
}
