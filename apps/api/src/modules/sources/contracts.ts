// Feature IDs: SOURCES.CATALOG, SOURCES.SAFE_FETCH, SOURCES.DOCUMENT_HISTORY, NOTICES.EXTRACTION
import { isIP } from "node:net";
import { z } from "zod";

export const sourceIdSchema = z.string().regex(/^[a-z][a-z0-9-]{1,63}$/);
const timestamp = z.string().datetime({ offset: true });
const hostname = z
  .string()
  .max(253)
  .refine((value) => {
    if (
      value !== value.toLowerCase() ||
      value.endsWith(".") ||
      isIP(value) ||
      !value.includes(".")
    )
      return false;
    const labels = value.split(".");
    return (
      !["localhost", "local", "internal"].includes(labels.at(-1) ?? "") &&
      labels.every((label) =>
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
      )
    );
  }, "Canonical DNS hostname required");
const pathPrefix = z
  .string()
  .max(200)
  .refine(
    (value) =>
      value === "/" ||
      (/^\/[a-zA-Z0-9._~/-]+$/.test(value) &&
        !value.endsWith("/") &&
        !value.includes("//") &&
        !value
          .split("/")
          .some((segment) => segment === "." || segment === "..")),
    "Normalized absolute path prefix required",
  );

export const fetchPolicySchema = z
  .object({
    timeoutMs: z.number().int().min(100).max(30_000),
    maxResponseBytes: z.number().int().min(1).max(10_000_000),
    minIntervalMs: z.number().int().min(1_000).max(604_800_000),
    maxRedirects: z.number().int().min(0).max(3),
    maxRetries: z.number().int().min(0).max(3),
    allowedContentTypes: z
      .array(z.enum(["text/html", "text/plain", "application/pdf"]))
      .min(1)
      .max(3),
  })
  .strict();

const approvedReview = z
  .object({
    decision: z.literal("approved"),
    reviewedBy: z.string().min(1).max(120),
    reviewedAt: timestamp,
    evidenceUrl: z.string().url(),
    permissionBasis: z.string().min(10).max(2000),
  })
  .strict();

export const sourceDefinitionSchema = z
  .object({
    id: sourceIdSchema,
    name: z.string().min(1).max(200),
    kind: z.literal("municipal_notice"),
    enabled: z.boolean(),
    locations: z
      .array(
        z
          .object({
            hostname,
            pathPrefixes: z.array(pathPrefix).min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    review: z.discriminatedUnion("decision", [
      z.object({ decision: z.literal("pending") }).strict(),
      z
        .object({ decision: z.literal("denied"), reason: z.string().min(1) })
        .strict(),
      approvedReview,
    ]),
    parserVersion: z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),
    fetchPolicy: fetchPolicySchema,
  })
  .strict()
  .superRefine((source, ctx) => {
    if (
      new Set(source.locations.map(({ hostname }) => hostname)).size !==
      source.locations.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["locations"],
        message: "Duplicate host",
      });
    }
    for (const [index, location] of source.locations.entries()) {
      if (
        new Set(location.pathPrefixes).size !== location.pathPrefixes.length
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["locations", index, "pathPrefixes"],
          message: "Duplicate path prefix",
        });
      }
    }
  });

export const approvedSourceSchema = sourceDefinitionSchema.refine(
  (source) => source.review.decision === "approved",
  {
    path: ["review"],
    message: "Source approval required",
  },
);
export type FetchPolicy = z.infer<typeof fetchPolicySchema>;
export type SourceDefinition = z.infer<typeof sourceDefinitionSchema>;
export type ApprovedSource = z.infer<typeof approvedSourceSchema>;

export const sourceDocumentSchema = z
  .object({
    id: z.string().uuid(),
    sourceId: sourceIdSchema,
    ingestionRunId: z.string().uuid(),
    canonicalUrl: z.string().url(),
    retrievedAt: timestamp,
    publishedAt: timestamp.nullable(),
    contentHashSha256: z.string().regex(/^[a-f0-9]{64}$/),
    contentType: z.string().min(1).max(100),
  })
  .strict();

export const ingestionRunSchema = z
  .object({
    id: z.string().uuid(),
    sourceId: sourceIdSchema,
    status: z.enum(["started", "succeeded", "failed", "partial"]),
    startedAt: timestamp,
    completedAt: timestamp.nullable(),
    discoveredCount: z.number().int().nonnegative(),
    acceptedCount: z.number().int().nonnegative(),
    rejectedCount: z.number().int().nonnegative(),
    errorCode: z.string().nullable(),
  })
  .strict()
  .refine((run) => (run.status === "started") === (run.completedAt === null), {
    path: ["completedAt"],
    message: "Only started runs can lack a completion timestamp",
  });

export const noticeCandidateSchema = z
  .object({
    sourceDocumentId: z.string().uuid(),
    sourceId: sourceIdSchema,
    canonicalUrl: z.string().url(),
    retrievedAt: timestamp,
    publishedAt: timestamp.nullable(),
    effectiveFrom: timestamp.nullable(),
    effectiveTo: timestamp.nullable(),
    locationText: z.string().nullable(),
    crop: z.string().nullable(),
    treatmentSubject: z.string().nullable(),
    spatialPrecision: z.literal("text_only"),
    reviewStatus: z.enum(["pending", "verified", "rejected"]),
    extractionMethod: z.enum(["structured", "model", "human"]),
    sourceVersion: z.string().min(1),
    evidenceExcerpts: z.array(
      z.object({ field: z.string().min(1), quote: z.string().min(1) }).strict(),
    ),
    dataQualityFlags: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((notice, ctx) => {
    if (
      notice.effectiveFrom !== null &&
      notice.effectiveTo !== null &&
      Date.parse(notice.effectiveFrom) > Date.parse(notice.effectiveTo)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveTo"],
        message: "Notice end cannot precede its start",
      });
    }
    if (
      notice.reviewStatus === "verified" &&
      notice.evidenceExcerpts.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidenceExcerpts"],
        message: "Verified claims require evidence",
      });
    }
  });

export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type IngestionRun = z.infer<typeof ingestionRunSchema>;
export type NoticeCandidate = z.infer<typeof noticeCandidateSchema>;
