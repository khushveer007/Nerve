import { describe, expect, it } from "vitest";
import { assistantQueryEnvelopeSchema } from "../../rag/schemas.js";

describe("assistantQueryEnvelopeSchema", () => {
  it("rejects malformed calendar dates in Phase 1 filters", () => {
    const parsed = assistantQueryEnvelopeSchema.safeParse({
      query: {
        mode: "search",
        text: "Adobe Creative Suite",
        filters: {
          department: "Design",
          date_range: {
            start: "2026-02-31",
            end: "2026-03-01",
          },
          sort: "newest",
        },
      },
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected malformed assistant date filters to fail validation.");
    }
    expect(parsed.error.issues.some((issue) => issue.message === "Invalid calendar date.")).toBe(true);
  });
});
