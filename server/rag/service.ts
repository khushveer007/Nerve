import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { buildAssistantSourceOpenPath } from "./acl.js";
import {
  answerGenerationEnabled,
  assessGroundedAnswerEvidence,
  buildAskFollowUpSuggestions,
  generateGroundedAnswer,
} from "./answering.js";
import { embeddingsEnabled, embedQueryText } from "./embeddings.js";
import {
  getAssistantHealthSnapshot,
  getAuthorizedAssistantEntrySource,
  searchEntryKnowledge,
} from "./db.js";
import { resolveAssistantMode } from "./intent.js";
import type {
  AssistantActorContext,
  AssistantHealthResponse,
  AssistantQueryInput,
  AssistantQueryResult,
  AssistantSourceOpenResult,
  AssistantSourcePreviewResult,
  AssistantSourceReference,
} from "./types.js";

export class AssistantAuthorizationError extends Error {}

export async function getAssistantHealth(): Promise<AssistantHealthResponse> {
  if (!config.assistant.enabled) {
    return {
      available: false,
      title: "Assistant search is disabled in this environment.",
      description: "Enable the assistant backend settings to expose the entry-backed query service.",
      nextStep: "Set the assistant feature flags and restart the API plus worker services.",
    };
  }

  const snapshot = await getAssistantHealthSnapshot();
  if (snapshot.ready_assets > 0) {
    return {
      available: true,
      title: "Assistant is available.",
      description: `Entry-backed search is live with ${snapshot.ready_assets} indexed knowledge asset${snapshot.ready_assets === 1 ? "" : "s"}.`,
      nextStep: "Submit a query to search the Phase 1 entry corpus.",
    };
  }

  return {
    available: true,
    title: "Assistant is preparing the entry corpus.",
    description: snapshot.queued_jobs > 0 || snapshot.running_jobs > 0
      ? "The backend is healthy and the initial entry backfill is still running."
      : "The backend is healthy, but the entry corpus has not been indexed yet.",
    nextStep: "Start the worker or wait for queued jobs to finish before validating search results.",
  };
}

function buildSourceReference(result: AssistantQueryResult["results"][number]): AssistantSourceReference {
  return {
    asset_id: result.asset_id,
    asset_version_id: result.asset_version_id,
    chunk_id: result.chunk_id,
    entry_id: result.entry_id,
    source_kind: "entry",
  };
}

async function loadGroundedAnswerEvidence(
  actor: AssistantActorContext,
  results: AssistantQueryResult["results"],
) {
  const selectedResults = results.slice(0, 3);
  const previews = await Promise.all(selectedResults.map(async (result, index) => {
    const preview = await getAuthorizedAssistantEntrySource({
      actor,
      source: buildSourceReference(result),
    });

    if (!preview) {
      return null;
    }

    return {
      label: `S${index + 1}`,
      result,
      excerpt: preview.excerpt,
    };
  }));

  return previews.filter((item): item is NonNullable<typeof item> => item !== null);
}

export async function executeAssistantQuery(
  actor: AssistantActorContext,
  input: AssistantQueryInput,
): Promise<AssistantQueryResult> {
  const resolvedMode = resolveAssistantMode(input).mode;
  const requestId = randomUUID();
  let queryEmbedding: string | null = null;

  if (embeddingsEnabled()) {
    try {
      queryEmbedding = await embedQueryText(input.text);
    } catch {
      queryEmbedding = null;
    }
  }

  const search = await searchEntryKnowledge({
    actor,
    queryText: input.text,
    queryEmbedding,
    queryEmbeddingMaxDistance: config.assistant.embeddings.maxQueryDistance,
    filters: input.filters,
    limit: config.assistant.queryResultLimit,
  });

  if (resolvedMode === "search") {
    return {
      mode: resolvedMode,
      answer: null,
      enough_evidence: search.totalCount > 0,
      grounded: false,
      citations: [],
      applied_filters: input.filters,
      total_results: search.totalCount,
      results: search.results,
      follow_up_suggestions: buildAskFollowUpSuggestions(
        search.totalCount === 0 ? "no_results" : "search",
        search.totalCount,
      ),
      request_id: requestId,
    };
  }

  const answerEvidence = await loadGroundedAnswerEvidence(actor, search.results);
  const assessment = assessGroundedAnswerEvidence(input.text, answerEvidence);

  if (!assessment.enoughEvidence) {
    return {
      mode: resolvedMode,
      answer: null,
      enough_evidence: false,
      grounded: false,
      citations: [],
      applied_filters: input.filters,
      total_results: search.totalCount,
      results: search.results,
      follow_up_suggestions: buildAskFollowUpSuggestions(
        assessment.reason === 'sufficient' ? 'weak_evidence' : assessment.reason,
        search.totalCount,
      ),
      request_id: requestId,
    };
  }

  if (!answerGenerationEnabled()) {
    return {
      mode: resolvedMode,
      answer: null,
      enough_evidence: true,
      grounded: false,
      citations: [],
      applied_filters: input.filters,
      total_results: search.totalCount,
      results: search.results,
      follow_up_suggestions: buildAskFollowUpSuggestions("answer_service_unavailable", search.totalCount),
      request_id: requestId,
    };
  }

  try {
    const groundedAnswer = await generateGroundedAnswer(input.text, assessment.evidence);

    return {
      mode: resolvedMode,
      answer: groundedAnswer.answer,
      enough_evidence: true,
      grounded: true,
      citations: groundedAnswer.citations,
      applied_filters: input.filters,
      total_results: search.totalCount,
      results: search.results,
      follow_up_suggestions: groundedAnswer.followUpSuggestions,
      request_id: requestId,
    };
  } catch {
    return {
      mode: resolvedMode,
      answer: null,
      enough_evidence: true,
      grounded: false,
      citations: [],
      applied_filters: input.filters,
      total_results: search.totalCount,
      results: search.results,
      follow_up_suggestions: buildAskFollowUpSuggestions("answer_service_unavailable", search.totalCount),
      request_id: requestId,
    };
  }

}

function buildOpenTarget(source: AssistantSourceReference) {
  return {
    kind: "internal" as const,
    path: buildAssistantSourceOpenPath(source),
    label: "Open source detail",
  };
}

export async function getAssistantSourcePreview(
  actor: AssistantActorContext,
  source: AssistantSourceReference,
): Promise<AssistantSourcePreviewResult> {
  const preview = await getAuthorizedAssistantEntrySource({
    actor,
    source,
  });

  if (!preview) {
    throw new AssistantAuthorizationError("You are not authorized to access that source.");
  }

  return {
    preview: {
      source,
      title: preview.title,
      excerpt: preview.excerpt,
      metadata: preview.metadata,
      open_target: buildOpenTarget(source),
    },
  };
}

export async function getAssistantSourceOpen(
  actor: AssistantActorContext,
  source: AssistantSourceReference,
): Promise<AssistantSourceOpenResult> {
  const authorizedSource = await getAuthorizedAssistantEntrySource({
    actor,
    source,
  });

  if (!authorizedSource) {
    throw new AssistantAuthorizationError("You are not authorized to access that source.");
  }

  return {
    open: {
      source,
      target: buildOpenTarget(source),
    },
  };
}
