import type {
  AssistantIntentResolution,
  AssistantQueryInput,
  AssistantResolvedMode,
} from "./types.js";

const RETRIEVAL_PREFIXES = [
  "find",
  "show",
  "list",
  "search",
  "lookup",
  "locate",
  "open",
  "which",
  "where",
];

const SYNTHESIS_PREFIXES = [
  "summarize",
  "summary",
  "compare",
  "explain",
  "describe",
  "outline",
  "analyze",
  "analyse",
  "why",
  "how",
  "what",
];

const KNOWN_ITEM_CUES = [
  " entry",
  " entries",
  " title",
  " titles",
  " document",
  " documents",
  " notice",
  " notices",
  " memo",
  " policy",
  " guidance",
  " department",
  " tag",
  " tags",
];

const SYNTHESIS_PHRASES = [
  "what does",
  "what is",
  "why does",
  "how do",
  "how does",
  "tell me about",
  "brief me on",
];

function normalizeQuery(text: string) {
  return ` ${text.trim().toLowerCase().replace(/\s+/g, " ")} `;
}

function startsWithCue(query: string, cues: string[]) {
  return cues.some((cue) => query.startsWith(` ${cue} `) || query.startsWith(` ${cue}?`));
}

function includesCue(query: string, cues: string[]) {
  return cues.some((cue) => query.includes(cue));
}

function resolveAutoMode(text: string): AssistantIntentResolution {
  const query = normalizeQuery(text);
  const explicitRetrieval = startsWithCue(query, RETRIEVAL_PREFIXES);
  const explicitSynthesis = startsWithCue(query, SYNTHESIS_PREFIXES)
    || includesCue(query, SYNTHESIS_PHRASES)
    || query.trim().endsWith("?");
  const knownItemCue = includesCue(query, KNOWN_ITEM_CUES);

  if (explicitRetrieval) {
    return {
      mode: "search",
      reason: "The request contains direct retrieval phrasing.",
    };
  }

  if (explicitSynthesis) {
    return {
      mode: "ask",
      reason: "The request asks for explanation, synthesis, or comparison.",
    };
  }

  if (knownItemCue) {
    return {
      mode: "search",
      reason: "The request contains known-item cues.",
    };
  }

  return {
    mode: "search",
    reason: "Ambiguous auto queries default to evidence-led search in Phase 1.",
  };
}

export function resolveAssistantMode(input: AssistantQueryInput): AssistantIntentResolution {
  if (input.mode === "search" || input.mode === "ask") {
    return {
      mode: input.mode as AssistantResolvedMode,
      reason: "The user explicitly selected a mode.",
    };
  }

  return resolveAutoMode(input.text);
}
