import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { buildAssistantSourceOpenPath } from "./acl.js";
import {
  getAssistantHealthSnapshot,
  getAuthorizedAssistantEntrySource,
  searchEntryKnowledge,
} from "./db.js";
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

function buildFollowUpSuggestions(resultCount: number, mode: AssistantQueryResult["mode"]) {
  if (resultCount === 0) {
    return [
      "Try an exact entry title, department name, or tag from the existing corpus.",
      "Keep queries entry-focused in Phase 1 because uploads and mixed media arrive in later stories.",
    ];
  }

  if (mode === "ask") {
    return [
      "Grounded answer synthesis is reserved for a later story, so this turn returns entry matches only.",
      "Refine the query with a department, title phrase, or date to narrow the corpus.",
    ];
  }

  return [
    "Refine the query with a department, title phrase, or date to narrow the corpus.",
    "Switch to Ask mode later when grounded synthesis is enabled on top of this corpus.",
  ];
}

export async function executeAssistantQuery(
  actor: AssistantActorContext,
  input: AssistantQueryInput,
): Promise<AssistantQueryResult> {
  const resolvedMode: AssistantQueryResult["mode"] = input.mode === "ask" ? "ask" : "search";
  const results = await searchEntryKnowledge({
    actor,
    queryText: input.text,
    filters: input.filters,
    limit: config.assistant.queryResultLimit,
  });

  return {
    mode: resolvedMode,
    answer: null,
    enough_evidence: results.length > 0,
    grounded: false,
    citations: results.slice(0, 3).map((result, index) => ({
      label: `S${index + 1}`,
      asset_id: result.asset_id,
      title: result.title,
      source_kind: "entry",
      snippet: result.snippet,
      citation_locator: result.citation_locator,
    })),
    results,
    follow_up_suggestions: buildFollowUpSuggestions(results.length, resolvedMode),
    request_id: randomUUID(),
  };
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
