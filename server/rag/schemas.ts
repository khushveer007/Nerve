import { z } from "zod";

const assistantModeSchema = z.enum(["auto", "search", "ask"]);

const assistantQueryFiltersSchema = z.object({
  departments: z.array(z.string().min(1)).default([]),
  entry_types: z.array(z.string().min(1)).default([]),
  priorities: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
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
