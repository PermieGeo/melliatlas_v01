// Feature IDs: SOURCES.SAFE_FETCH
import { isIP } from "node:net";
import { sourceDefinitionSchema } from "./contracts.js";

export type DestinationDecision =
  | { allowed: true; sourceId: string; canonicalUrl: string }
  | {
      allowed: false;
      reason:
        | "INVALID_SOURCE"
        | "SOURCE_DISABLED"
        | "SOURCE_NOT_APPROVED"
        | "INVALID_URL"
        | "FORBIDDEN_HOST"
        | "FORBIDDEN_PATH";
    };

function matchesPath(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) =>
      prefix === "/" || path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Preflight only: the future transport must additionally validate DNS answers,
 * connected IP addresses, redirects, payload limits and transport proxy settings.
 */
export function evaluateSourceDestination(
  sourceInput: unknown,
  urlInput: unknown,
): DestinationDecision {
  const result = sourceDefinitionSchema.safeParse(sourceInput);
  if (!result.success) return { allowed: false, reason: "INVALID_SOURCE" };
  const source = result.data;
  if (!source.enabled) return { allowed: false, reason: "SOURCE_DISABLED" };
  if (
    source.review.decision !== "approved" &&
    !(source.kind === "treatment" && source.review.decision === "configured")
  )
    return { allowed: false, reason: "SOURCE_NOT_APPROVED" };
  if (
    typeof urlInput !== "string" ||
    urlInput.length === 0 ||
    urlInput.length > 2048 ||
    /[\\\s\u0000-\u001f\u007f]/.test(urlInput) ||
    /%(?:00|25|2e|2f|5c)/i.test(urlInput)
  ) {
    return { allowed: false, reason: "INVALID_URL" };
  }

  let url: URL;
  try {
    url = new URL(urlInput);
  } catch {
    return { allowed: false, reason: "INVALID_URL" };
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.port ||
    url.hostname.endsWith(".") ||
    url.hostname.startsWith("[") ||
    isIP(url.hostname)
  ) {
    return { allowed: false, reason: "INVALID_URL" };
  }
  const location = source.locations.find(
    ({ hostname }) => hostname === url.hostname,
  );
  if (!location) return { allowed: false, reason: "FORBIDDEN_HOST" };
  if (!matchesPath(url.pathname, location.pathPrefixes))
    return { allowed: false, reason: "FORBIDDEN_PATH" };
  return { allowed: true, sourceId: source.id, canonicalUrl: url.toString() };
}
