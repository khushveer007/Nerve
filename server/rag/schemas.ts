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
