import { z } from "zod";

const proseSchema = z.string().trim().min(1).max(1600);
const sectionSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
    title: proseSchema,
    paragraphs: z.array(proseSchema).min(1).max(8),
    steps: z.array(proseSchema).min(1).max(12).optional(),
    notes: z.array(proseSchema).min(1).max(8).optional(),
  })
  .strict();

/** Validates separately hosted, localized help documents before rendering. */
export const helpDocumentSchema = z
  .object({
    version: z.literal(1),
    locale: z.enum(["ru", "en"]),
    title: proseSchema,
    intro: proseSchema,
    sections: z.array(sectionSchema).min(1).max(20),
    example: sectionSchema,
    warningsTitle: proseSchema,
    warnings: z.array(proseSchema).min(1).max(10),
  })
  .strict()
  .refine(
    (document) =>
      new Set(document.sections.map((section) => section.id)).size ===
      document.sections.length,
    "Duplicate help section identifiers",
  );

export type HelpDocument = z.infer<typeof helpDocumentSchema>;
export type HelpSection = HelpDocument["sections"][number];
