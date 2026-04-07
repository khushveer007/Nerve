import { describe, expect, it } from "vitest";
import {
  buildAssistantFilterSummary,
  classifyJobFailure,
  classifyProviderFailureSubtype,
} from "../../observability/helpers.js";
import {
  assistantQueryEnvelopeSchema,
  assistantQueryResultEnvelopeSchema,
} from "../../rag/schemas.js";

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

describe("assistantQueryResultEnvelopeSchema", () => {
  it("accepts grounded ask responses with inline-citation support", () => {
    const parsed = assistantQueryResultEnvelopeSchema.safeParse({
      result: {
        mode: "ask",
        answer: "NABH accreditation has been granted to the medical college. [S1]",
        enough_evidence: true,
        grounded: true,
        citations: [
          {
            label: "S1",
            asset_id: "asset_1",
            title: "Medical College Gets NABH Accreditation",
            source_kind: "entry",
            snippet: "Parul Institute of Medical Sciences and Research has been granted NABH accreditation.",
            source: {
              asset_id: "asset_1",
              asset_version_id: "asset_version_1",
              chunk_id: "chunk_1",
              entry_id: "entry_1",
              source_kind: "entry",
            },
            actions: {
              preview: { available: true },
              open_source: { available: true },
            },
            citation_locator: {
              asset_id: "asset_1",
              asset_version_id: "asset_version_1",
              chunk_id: "chunk_1",
              title: "Medical College Gets NABH Accreditation",
              source_kind: "entry",
              page_from: null,
              page_to: null,
              heading_path: ["Entry overview"],
              char_start: 0,
              char_end: 180,
            },
          },
        ],
        applied_filters: {
          department: null,
          date_range: {
            start: null,
            end: null,
          },
          sort: "relevance",
        },
        total_results: 1,
        results: [
          {
            asset_id: "asset_1",
            asset_version_id: "asset_version_1",
            chunk_id: "chunk_1",
            entry_id: "entry_1",
            title: "Medical College Gets NABH Accreditation",
            source_kind: "entry",
            media_type: "text",
            snippet: "Parul Institute of Medical Sciences and Research has been granted NABH accreditation.",
            score: 0.071,
            metadata: {
              source_kind: "entry",
              entry_id: "entry_1",
              dept: "Medical",
              type: "Achievement",
              tags: ["accreditation", "nabh"],
              entry_date: "2026-01-20",
              academic_year: "2025-26",
              author_name: "Dr. Vikram Singh",
              created_by: "ba-001",
              priority: "Key highlight",
              student_count: null,
              external_link: "",
              collaborating_org: "National Accreditation Board for Hospitals",
            },
            citation_locator: {
              asset_id: "asset_1",
              asset_version_id: "asset_version_1",
              chunk_id: "chunk_1",
              title: "Medical College Gets NABH Accreditation",
              source_kind: "entry",
              page_from: null,
              page_to: null,
              heading_path: ["Entry overview"],
              char_start: 0,
              char_end: 180,
            },
            actions: {
              preview: { available: true },
              open_source: { available: true },
            },
          },
        ],
        follow_up_suggestions: [
          "Ask for department-specific details if you want a narrower follow-up.",
        ],
        request_id: "0f5038aa-c655-4709-a327-9db50f85eb1d",
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects grounded responses that omit either answer text or citations", () => {
    const parsed = assistantQueryResultEnvelopeSchema.safeParse({
      result: {
        mode: "ask",
        answer: null,
        enough_evidence: true,
        grounded: true,
        citations: [],
        applied_filters: {
          department: null,
          date_range: {
            start: null,
            end: null,
          },
          sort: "relevance",
        },
        total_results: 0,
        results: [],
        follow_up_suggestions: [],
        request_id: "0f5038aa-c655-4709-a327-9db50f85eb1d",
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts no-answer ask responses with explicit abstention state", () => {
    const parsed = assistantQueryResultEnvelopeSchema.safeParse({
      result: {
        mode: "ask",
        answer: null,
        enough_evidence: false,
        grounded: false,
        citations: [],
        applied_filters: {
          department: "Design",
          date_range: {
            start: null,
            end: null,
          },
          sort: "newest",
        },
        total_results: 2,
        results: [],
        follow_up_suggestions: [
          "Try asking about a single entry title from the sources available to you.",
        ],
        request_id: "0f5038aa-c655-4709-a327-9db50f85eb1d",
      },
    });

    expect(parsed.success).toBe(true);
  });
});

describe("assistant observability helpers", () => {
  it("builds a filter summary without persisting raw query text", () => {
    expect(buildAssistantFilterSummary({
      department: "Design",
      date_range: {
        start: "2026-04-01",
        end: null,
      },
      sort: "newest",
    })).toEqual({
      department: "Design",
      sort: "newest",
      has_date_start: true,
      has_date_end: false,
    });
  });

  it("classifies provider timeout and payload failures into stable subtypes", () => {
    expect(classifyProviderFailureSubtype("embedding", new Error("Embedding request timed out."))).toBe(
      "embedding_timeout",
    );
    expect(
      classifyProviderFailureSubtype(
        "answering",
        new Error("Answer provider payload did not match the grounded answer schema."),
      ),
    ).toBe("answering_invalid_payload");
  });

  it("maps indexing provider failures separately from retrieval failures", () => {
    expect(classifyJobFailure(new Error("Embedding request failed with status 503."))).toEqual({
      classification: "provider_failure",
      subtype: "embedding_http_error",
    });
    expect(classifyJobFailure(new Error("Embedding response payload was invalid."))).toEqual({
      classification: "provider_failure",
      subtype: "embedding_invalid_payload",
    });
    expect(classifyJobFailure(new Error("Entry entry-does-not-exist no longer exists."))).toEqual({
      classification: "retrieval_failure",
      subtype: "job_processing_failure",
    });
  });
});
