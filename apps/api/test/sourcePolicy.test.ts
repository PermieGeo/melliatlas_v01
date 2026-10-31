// Feature IDs: SOURCES.CATALOG, SOURCES.SAFE_FETCH, SOURCES.DOCUMENT_HISTORY, NOTICES.EXTRACTION
import { describe, expect, it } from "vitest";
import {
  approvedSourceSchema,
  ingestionRunSchema,
  noticeCandidateSchema,
  sourceDefinitionSchema,
  sourceDocumentSchema,
} from "../src/modules/sources/contracts.js";
import { evaluateSourceDestination } from "../src/modules/sources/destinationPolicy.js";

const time = "2026-10-31T12:00:00.000Z";
const uuid = "36e4f7bc-6605-4fe5-a472-9f5bf875c36b";
const approvedSource = {
  id: "demo-municipal",
  name: "Synthetic municipal source",
  kind: "municipal_notice",
  enabled: true,
  locations: [
    { hostname: "notices.example.org", pathPrefixes: ["/notices"] },
    { hostname: "archive.example.org", pathPrefixes: ["/public"] },
  ],
  review: {
    decision: "approved",
    reviewedBy: "fixture-reviewer",
    reviewedAt: time,
    evidenceUrl: "https://example.org/fixture-terms",
    permissionBasis: "Synthetic approval for deterministic unit tests only",
  },
  parserVersion: "html-v1",
  fetchPolicy: {
    timeoutMs: 8000,
    maxResponseBytes: 500_000,
    minIntervalMs: 60_000,
    maxRedirects: 1,
    maxRetries: 2,
    allowedContentTypes: ["text/html"],
  },
} as const;

function decide(url: unknown, source: unknown = approvedSource) {
  return evaluateSourceDestination(source, url);
}

describe("municipal source policy preflight", () => {
  it("allows a registered HTTPS host and path, returning a canonical URL", () => {
    expect(decide("https://NOTICES.EXAMPLE.ORG/notices/2026?month=10")).toEqual(
      {
        allowed: true,
        sourceId: "demo-municipal",
        canonicalUrl: "https://notices.example.org/notices/2026?month=10",
      },
    );
    expect(decide("https://archive.example.org/public")).toMatchObject({
      allowed: true,
    });
  });

  it("blocks unapproved, denied, and disabled sources before any URL checks", () => {
    expect(
      decide("https://notices.example.org/notices", {
        ...approvedSource,
        review: { decision: "pending" },
      }),
    ).toEqual({ allowed: false, reason: "SOURCE_NOT_APPROVED" });
    expect(
      decide("https://notices.example.org/notices", {
        ...approvedSource,
        review: { decision: "denied", reason: "No permission" },
      }),
    ).toEqual({ allowed: false, reason: "SOURCE_NOT_APPROVED" });
    expect(
      decide("https://notices.example.org/notices", {
        ...approvedSource,
        enabled: false,
      }),
    ).toEqual({ allowed: false, reason: "SOURCE_DISABLED" });
  });

  it.each([
    "http://notices.example.org/notices",
    "https://user:pass@notices.example.org/notices",
    "https://notices.example.org/notices#fragment",
    "https://notices.example.org:444/notices",
    "https://notices.example.org./notices",
    "https://127.0.0.1/notices",
    "https://[::1]/notices",
    "https://notices.example.org/notices/%2e%2e/secret",
    "https://notices.example.org/notices/%2fsecret",
    "https://notices.example.org/notices/%252e%252e",
    "https://notices.example.org\\@evil.example.net/notices",
    " https://notices.example.org/notices",
    "https://notices.example.org/notices\n",
    "notices.example.org/notices",
    "file:///etc/passwd",
  ])("rejects malformed or unsafe URL %s", (url) => {
    expect(decide(url)).toEqual({ allowed: false, reason: "INVALID_URL" });
  });

  it.each([
    "https://evil.example.org/notices",
    "https://notices.example.org.evil.net/notices",
    "https://archive.example.org.evil.net/public",
  ])("blocks unregistered host %s", (url) => {
    expect(decide(url)).toEqual({ allowed: false, reason: "FORBIDDEN_HOST" });
  });

  it.each([
    "https://notices.example.org/notices-private",
    "https://notices.example.org/other/notices",
    "https://archive.example.org/notices",
    "https://notices.example.org/",
  ])("blocks a path outside its host-specific prefixes: %s", (url) => {
    expect(decide(url)).toEqual({ allowed: false, reason: "FORBIDDEN_PATH" });
  });

  it("fails closed for invalid source configuration or review evidence", () => {
    const noReviewer = { ...approvedSource, review: { decision: "approved" } };
    expect(approvedSourceSchema.safeParse(noReviewer).success).toBe(false);
    expect(decide("https://notices.example.org/notices", noReviewer)).toEqual({
      allowed: false,
      reason: "INVALID_SOURCE",
    });

    const wildcard = {
      ...approvedSource,
      locations: [{ hostname: "*.example.org", pathPrefixes: ["/"] }],
    };
    expect(sourceDefinitionSchema.safeParse(wildcard).success).toBe(false);
    expect(decide("https://notices.example.org/notices", wildcard)).toEqual({
      allowed: false,
      reason: "INVALID_SOURCE",
    });

    const repeated = {
      ...approvedSource,
      locations: [approvedSource.locations[0], approvedSource.locations[0]],
    };
    expect(sourceDefinitionSchema.safeParse(repeated).success).toBe(false);
    expect(
      sourceDefinitionSchema.safeParse({
        ...approvedSource,
        fetchPolicy: { ...approvedSource.fetchPolicy, timeoutMs: 0 },
      }).success,
    ).toBe(false);
  });
});

describe("ingestion domain contracts", () => {
  it("rejects malformed document hashes and unknown fields", () => {
    const document = {
      id: uuid,
      sourceId: "demo-municipal",
      ingestionRunId: uuid,
      canonicalUrl: "https://notices.example.org/notices/1",
      retrievedAt: time,
      publishedAt: null,
      contentHashSha256: "a".repeat(64),
      contentType: "text/html",
    };
    expect(sourceDocumentSchema.safeParse(document).success).toBe(true);
    expect(
      sourceDocumentSchema.safeParse({ ...document, contentHashSha256: "abc" })
        .success,
    ).toBe(false);
    expect(
      sourceDocumentSchema.safeParse({ ...document, arbitraryClaim: "trusted" })
        .success,
    ).toBe(false);
  });

  it("requires consistent completion times and nonnegative counts", () => {
    const run = {
      id: uuid,
      sourceId: "demo-municipal",
      status: "started",
      startedAt: time,
      completedAt: null,
      discoveredCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      errorCode: null,
    };
    expect(ingestionRunSchema.safeParse(run).success).toBe(true);
    expect(
      ingestionRunSchema.safeParse({ ...run, status: "succeeded" }).success,
    ).toBe(false);
    expect(
      ingestionRunSchema.safeParse({ ...run, acceptedCount: -1 }).success,
    ).toBe(false);
  });

  it("keeps unlocated notices text-only and refuses unsupported verified claims", () => {
    const candidate = {
      sourceDocumentId: uuid,
      sourceId: "demo-municipal",
      canonicalUrl: "https://notices.example.org/notices/1",
      retrievedAt: time,
      publishedAt: null,
      effectiveFrom: "2026-11-01T00:00:00.000Z",
      effectiveTo: null,
      locationText: "Example village",
      crop: null,
      treatmentSubject: null,
      spatialPrecision: "text_only",
      reviewStatus: "pending",
      extractionMethod: "structured",
      sourceVersion: "a".repeat(64),
      evidenceExcerpts: [],
      dataQualityFlags: ["location-unresolved"],
    };
    expect(noticeCandidateSchema.safeParse(candidate).success).toBe(true);
    expect(
      noticeCandidateSchema.safeParse({
        ...candidate,
        reviewStatus: "verified",
      }).success,
    ).toBe(false);
    expect(
      noticeCandidateSchema.safeParse({
        ...candidate,
        spatialPrecision: "exact_polygon",
      }).success,
    ).toBe(false);
    expect(
      noticeCandidateSchema.safeParse({
        ...candidate,
        effectiveTo: "2026-10-30T00:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      noticeCandidateSchema.safeParse({
        ...candidate,
        reviewStatus: "verified",
        evidenceExcerpts: [{ field: "locationText", quote: "Example village" }],
      }).success,
    ).toBe(true);
  });
});
