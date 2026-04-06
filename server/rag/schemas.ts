import { z } from "zod";

const assistantModeSchema = z.enum(["auto", "search", "ask"]);
const assistantSortSchema = z.enum(["relevance", "newest"]);

function isValidAssistantDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
  ) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day
  );
}

const assistantDateSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value ?? null;
    }

    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  },
  z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isValidAssistantDate, "Invalid calendar date.")
    .nullable(),
);

export const assistantQueryFiltersSchema = z.object({
  department: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value ?? null;
      }

      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().min(1).nullable(),
  ).default(null),
  date_range: z.object({
    start: assistantDateSchema.default(null),
    end: assistantDateSchema.default(null),
  }).superRefine((value, ctx) => {
    if (value.start && value.end && value.start > value.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date range end must be on or after the start date.",
        path: ["end"],
      });
    }
  }).default({}),
  sort: assistantSortSchema.default("relevance"),
}).default({});

export const assistantQueryEnvelopeSchema = z.object({
  query: z.object({
    mode: assistantModeSchema.default("auto"),
    text: z.string().trim().min(1),
    filters: assistantQueryFiltersSchema,
  }).strict(),
}).strict();

export type AssistantQueryEnvelope = z.infer<typeof assistantQueryEnvelopeSchema>;

const assistantSourceReferenceSchema = z.object({
  asset_id: z.string().min(1),
  asset_version_id: z.string().min(1),
  chunk_id: z.string().min(1),
  entry_id: z.string().min(1),
  source_kind: z.literal("entry"),
}).strict();

const citationLocatorSchema = z.object({
  asset_id: z.string().min(1),
  asset_version_id: z.string().min(1),
  chunk_id: z.string().min(1),
  title: z.string().min(1),
  source_kind: z.literal("entry"),
  page_from: z.number().int().nullable(),
  page_to: z.number().int().nullable(),
  heading_path: z.array(z.string()),
  char_start: z.number().int().min(0),
  char_end: z.number().int().min(0),
}).strict();

const assistantResultActionAvailabilitySchema = z.object({
  available: z.boolean(),
}).strict();

const assistantResultActionsSchema = z.object({
  preview: assistantResultActionAvailabilitySchema,
  open_source: assistantResultActionAvailabilitySchema,
}).strict();

const assistantEntryMetadataSchema = z.object({
  source_kind: z.literal("entry"),
  entry_id: z.string().min(1),
  dept: z.string().min(1),
  type: z.string().min(1),
  tags: z.array(z.string()),
  entry_date: z.string().min(1),
  academic_year: z.string(),
  author_name: z.string(),
  created_by: z.string().nullable(),
  priority: z.string().min(1),
  student_count: z.number().int().nullable(),
  external_link: z.string(),
  collaborating_org: z.string(),
}).strict();

const assistantEntryResultSchema = z.object({
  asset_id: z.string().min(1),
  asset_version_id: z.string().min(1),
  chunk_id: z.string().min(1),
  entry_id: z.string().min(1),
  title: z.string().min(1),
  source_kind: z.literal("entry"),
  media_type: z.literal("text"),
  snippet: z.string().min(1),
  score: z.number(),
  metadata: assistantEntryMetadataSchema,
  citation_locator: citationLocatorSchema,
  actions: assistantResultActionsSchema,
}).strict();

const assistantCitationSchema = z.object({
  label: z.string().regex(/^S\d+$/),
  asset_id: z.string().min(1),
  title: z.string().min(1),
  source_kind: z.literal("entry"),
  snippet: z.string().min(1),
  source: assistantSourceReferenceSchema,
  actions: assistantResultActionsSchema,
  citation_locator: citationLocatorSchema,
}).strict();

export const assistantQueryResultSchema = z.object({
  mode: z.enum(["search", "ask"]),
  answer: z.string().min(1).nullable(),
  enough_evidence: z.boolean(),
  grounded: z.boolean(),
  citations: z.array(assistantCitationSchema),
  applied_filters: assistantQueryFiltersSchema,
  total_results: z.number().int().min(0),
  results: z.array(assistantEntryResultSchema),
  follow_up_suggestions: z.array(z.string().min(1)),
  request_id: z.string().uuid(),
}).superRefine((value, ctx) => {
  if (value.grounded && value.answer === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Grounded answers must include answer text.",
      path: ["answer"],
    });
  }

  if (value.grounded && value.citations.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Grounded answers must include citations.",
      path: ["citations"],
    });
  }

  if (value.grounded && !value.enough_evidence) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Grounded answers must report enough evidence.",
      path: ["enough_evidence"],
    });
  }
});

export const assistantQueryResultEnvelopeSchema = z.object({
  result: assistantQueryResultSchema,
}).strict();

export const assistantSourcePreviewEnvelopeSchema = z.object({
  preview: z.object({
    source: assistantSourceReferenceSchema,
  }).strict(),
}).strict();

export const assistantSourceOpenEnvelopeSchema = z.object({
  open: z.object({
    source: assistantSourceReferenceSchema,
  }).strict(),
}).strict();

export type AssistantSourcePreviewEnvelope = z.infer<typeof assistantSourcePreviewEnvelopeSchema>;
export type AssistantSourceOpenEnvelope = z.infer<typeof assistantSourceOpenEnvelopeSchema>;
