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

const assistantQueryFiltersSchema = z.object({
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
