import { z } from "zod";
import { config } from "../config.js";
import { buildGroundedAnswerMessages } from "./prompts.js";
import type {
  AssistantCitation,
  AssistantEntrySearchResult,
} from "./types.js";

const MINIMUM_TOP_SCORE = 0.025;
const STRONG_TOP_SCORE = 0.045;

const QUERY_STOP_WORDS = new Set([
  "a",
  "an",
  "about",
  "across",
  "all",
  "and",
  "answer",
  "answers",
  "ask",
  "as",
  "at",
  "compare",
  "describe",
  "detail",
  "details",
  "does",
  "explain",
  "for",
  "from",
  "give",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "nerve",
  "of",
  "on",
  "or",
  "outline",
  "please",
  "says",
  "summarize",
  "summary",
  "tell",
  "that",
  "the",
  "their",
  "this",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
]);

const NEGATION_TERMS = new Set([
  "cannot",
  "cant",
  "didnt",
  "doesnt",
  "dont",
  "failed",
  "inactive",
  "isnt",
  "lack",
  "lacks",
  "lacking",
  "missing",
  "negative",
  "never",
  "no",
  "none",
  "not",
  "unable",
  "unavailable",
  "without",
  "wont",
]);

const CONTRADICTORY_TERM_GROUPS: Array<[string, string]> = [
  ["active", "inactive"],
  ["approved", "rejected"],
  ["available", "unavailable"],
  ["confirmed", "cancelled"],
  ["enabled", "disabled"],
  ["offline", "online"],
  ["onsite", "remote"],
  ["open", "closed"],
  ["optional", "required"],
  ["private", "public"],
];

const CONTRADICTORY_TERMS = new Set<string>(CONTRADICTORY_TERM_GROUPS.flat());

const groundedAnswerSchema = z.object({
  claims: z.array(z.object({
    text: z.string().trim().min(1),
    citations: z.array(z.string().regex(/^S\d+$/)).min(1),
  })).min(1).max(3),
  follow_up_suggestions: z.array(z.string().trim().min(1)).max(4).default([]),
});

export type AskFallbackReason =
  | "no_results"
  | "weak_evidence"
  | "conflicting_evidence"
  | "answer_service_unavailable";

export interface AssistantAnswerEvidence {
  label: string;
  excerpt: string;
  result: AssistantEntrySearchResult;
}

export interface AssistantEvidenceAssessment {
  enoughEvidence: boolean;
  reason: AskFallbackReason | "sufficient";
  evidence: AssistantAnswerEvidence[];
}

function buildAnswerHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.assistant.answering.apiKey && config.assistant.answering.authHeader) {
    headers[config.assistant.answering.authHeader] = config.assistant.answering.authScheme
      ? `${config.assistant.answering.authScheme} ${config.assistant.answering.apiKey}`
      : config.assistant.answering.apiKey;
  }

  return headers;
}

function extractQueryTerms(question: string) {
  return Array.from(new Set(
    question
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((term) => term.length > 2 && !QUERY_STOP_WORDS.has(term))
      ?? [],
  ));
}

function countEvidenceTermMatches(questionTerms: string[], evidence: AssistantAnswerEvidence) {
  if (questionTerms.length === 0) {
    return 0;
  }

  const haystack = [
    evidence.result.title,
    evidence.result.snippet,
    evidence.excerpt,
  ].join(" ").toLowerCase();

  return questionTerms.reduce((count, term) => (
    haystack.includes(term) ? count + 1 : count
  ), 0);
}

function normalizeFenceWrappedJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  return trimmed;
}

function parseJsonPayload(text: string) {
  const normalized = normalizeFenceWrappedJson(text);

  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(normalized.slice(start, end + 1)) as unknown;
    }

    throw new Error("Answer provider returned invalid JSON.");
  }
}

function extractProviderText(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.output_text === "string") {
    return record.output_text;
  }

  if (Array.isArray(record.choices)) {
    const choice = record.choices[0] as
      | { message?: { content?: string | Array<{ text?: string }> }; text?: string }
      | undefined;

    if (typeof choice?.message?.content === "string") {
      return choice.message.content;
    }

    if (Array.isArray(choice?.message?.content)) {
      return choice.message.content
        .map((part) => typeof part?.text === "string" ? part.text : "")
        .join("")
        .trim();
    }

    if (typeof choice?.text === "string") {
      return choice.text;
    }
  }

  if (Array.isArray(record.output)) {
    const text = record.output
      .flatMap((item) => {
        if (typeof item !== "object" || item === null) {
          return [];
        }

        const content = (item as { content?: Array<{ text?: string }> }).content;
        return Array.isArray(content)
          ? content.map((part) => typeof part?.text === "string" ? part.text : "")
          : [];
      })
      .join("")
      .trim();

    return text || null;
  }

  return null;
}

function isNumericIntent(question: string) {
  return /(how many|how much|what year|which year|when|percentage|percent|rate|count|number)/i.test(question);
}

function extractPrimaryNumericValue(question: string, text: string) {
  if (/(what year|which year|when)/i.test(question)) {
    return text.match(/\b\d{4}\b/)?.[0] ?? null;
  }

  if (/(percentage|percent|rate)/i.test(question)) {
    return text.match(/\b\d+(?:\.\d+)?%/)?.[0] ?? null;
  }

  return text.match(/\b\d+(?:\.\d+)?\b/)?.[0] ?? null;
}

function extractStatementTokens(text: string): string[] {
  return text.match(/[a-z0-9]+/g) ?? [];
}

function buildComparableStatementTokens(tokens: string[]) {
  return tokens.filter((token) => (
    token.length > 2
    && !QUERY_STOP_WORDS.has(token)
    && !NEGATION_TERMS.has(token)
    && !CONTRADICTORY_TERMS.has(token)
  ));
}

function splitRelevantEvidenceStatements(questionTerms: string[], evidence: AssistantAnswerEvidence) {
  const combinedText = [
    evidence.result.title,
    evidence.result.snippet,
    evidence.excerpt,
  ].join(". ");

  return combinedText
    .split(/[\n.!?;:]+/)
    .map((statement) => statement.trim().toLowerCase())
    .filter((statement) => {
      if (statement.length === 0) {
        return false;
      }

      if (questionTerms.length === 0) {
        return true;
      }

      return questionTerms.some((term) => statement.includes(term));
    });
}

function statementsHaveOpposingPolarity(left: string, right: string) {
  const leftTokens = extractStatementTokens(left);
  const rightTokens = extractStatementTokens(right);
  const leftComparable = new Set(buildComparableStatementTokens(leftTokens));
  const rightComparable = new Set(buildComparableStatementTokens(rightTokens));
  const sharedComparableTerms = [...leftComparable].filter((token) => rightComparable.has(token));

  if (sharedComparableTerms.length < 2) {
    return false;
  }

  const leftHasNegation = leftTokens.some((token) => NEGATION_TERMS.has(token));
  const rightHasNegation = rightTokens.some((token) => NEGATION_TERMS.has(token));
  if (leftHasNegation !== rightHasNegation) {
    return true;
  }

  return CONTRADICTORY_TERM_GROUPS.some(([first, second]) => (
    (leftTokens.includes(first) && rightTokens.includes(second))
    || (leftTokens.includes(second) && rightTokens.includes(first))
  ));
}

function hasConflictingTextEvidence(question: string, evidence: AssistantAnswerEvidence[]) {
  const questionTerms = extractQueryTerms(question);
  const statements = evidence.map((item) => splitRelevantEvidenceStatements(questionTerms, item));

  for (let index = 0; index < statements.length; index += 1) {
    const currentStatements = statements[index] ?? [];

    for (let compareIndex = index + 1; compareIndex < statements.length; compareIndex += 1) {
      const nextStatements = statements[compareIndex] ?? [];

      for (const current of currentStatements) {
        for (const candidate of nextStatements) {
          if (statementsHaveOpposingPolarity(current, candidate)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

function hasConflictingNumericEvidence(question: string, evidence: AssistantAnswerEvidence[]) {
  if (!isNumericIntent(question)) {
    return false;
  }

  const values = evidence
    .map((item) => extractPrimaryNumericValue(
      question,
      `${item.result.title}. ${item.result.snippet}. ${item.excerpt}`,
    ))
    .filter((value): value is string => Boolean(value));

  return new Set(values).size > 1;
}

export function answerGenerationEnabled() {
  return Boolean(config.assistant.answering.url);
}

export function assessGroundedAnswerEvidence(
  question: string,
  evidence: AssistantAnswerEvidence[],
): AssistantEvidenceAssessment {
  if (evidence.length === 0) {
    return {
      enoughEvidence: false,
      reason: "no_results",
      evidence,
    };
  }

  if (hasConflictingNumericEvidence(question, evidence)) {
    return {
      enoughEvidence: false,
      reason: "conflicting_evidence",
      evidence,
    };
  }

  if (hasConflictingTextEvidence(question, evidence)) {
    return {
      enoughEvidence: false,
      reason: "conflicting_evidence",
      evidence,
    };
  }

  const topScore = evidence[0]?.result.score ?? 0;
  const questionTerms = extractQueryTerms(question);
  const maxCoverage = evidence.reduce((best, item) => (
    Math.max(best, countEvidenceTermMatches(questionTerms, item))
  ), 0);

  const enoughEvidence = topScore >= MINIMUM_TOP_SCORE
    && (topScore >= STRONG_TOP_SCORE || maxCoverage >= Math.min(2, Math.max(questionTerms.length, 1)));

  return {
    enoughEvidence,
    reason: enoughEvidence ? "sufficient" : "weak_evidence",
    evidence,
  };
}

function buildAnswerText(claims: Array<{ text: string; citations: string[] }>) {
  return claims
    .map((claim) => `${claim.text.trim()} ${claim.citations.map((label) => `[${label}]`).join(" ")}`.trim())
    .join("\n\n");
}

export function buildAskFollowUpSuggestions(reason: AskFallbackReason | "grounded" | "search", resultCount: number) {
  if (reason === "no_results" || resultCount === 0) {
    return [
      "Try an exact entry title, department name, or date range from the existing corpus.",
      "Keep queries entry-focused in Phase 1 because uploads and mixed media arrive in later stories.",
    ];
  }

  if (reason === "grounded") {
    return [
      "Open a supporting source below if you want to verify the cited entry evidence.",
      "Ask a narrower follow-up about a department, title, or date range for more detail.",
    ];
  }

  if (reason === "search") {
    return [
      "Refine the query with a department, title phrase, or date range to narrow the corpus.",
      "Use Ask mode when you want a grounded synthesis from the retrieved entry evidence.",
    ];
  }

  if (reason === "answer_service_unavailable") {
    return [
      "Grounded answer generation is temporarily unavailable, so review the supporting sources below.",
      "Try again after the answer provider is configured or available.",
    ];
  }

  return [
    "I do not have enough consistent evidence in the sources available to you to answer confidently yet.",
    "Try asking about a single entry title, department, or narrower date range, or inspect the supporting sources below.",
  ];
}

export async function generateGroundedAnswer(
  question: string,
  evidence: AssistantAnswerEvidence[],
): Promise<{
  answer: string;
  citations: AssistantCitation[];
  followUpSuggestions: string[];
}> {
  if (!config.assistant.answering.url) {
    throw new Error("Assistant answer provider is not configured.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, config.assistant.answering.timeoutMs);

  let response: Response;
  try {
    response = await fetch(config.assistant.answering.url, {
      method: "POST",
      headers: buildAnswerHeaders(),
      body: JSON.stringify({
        model: config.assistant.answering.model,
        temperature: 0,
        response_format: {
          type: "json_object",
        },
        messages: buildGroundedAnswerMessages(question, evidence.map((item) => ({
          label: item.label,
          title: item.result.title,
          snippet: item.result.snippet,
          excerpt: item.excerpt,
          department: item.result.metadata.dept,
          entryDate: item.result.metadata.entry_date,
          authorName: item.result.metadata.author_name,
          citationPath: item.result.citation_locator.heading_path,
        }))),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Answer request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Answer request failed with status ${response.status}.`);
  }

  const payload = await response.json() as unknown;
  const text = extractProviderText(payload);

  if (!text) {
    throw new Error("Answer provider response did not include text content.");
  }

  const parsed = groundedAnswerSchema.safeParse(parseJsonPayload(text));
  if (!parsed.success) {
    throw new Error("Answer provider payload did not match the grounded answer schema.");
  }

  const evidenceByLabel = new Map(evidence.map((item) => [item.label, item]));
  const orderedLabels: string[] = [];

  for (const claim of parsed.data.claims) {
    for (const label of claim.citations) {
      if (!evidenceByLabel.has(label)) {
        throw new Error(`Answer provider referenced unknown citation label: ${label}`);
      }

      if (!orderedLabels.includes(label)) {
        orderedLabels.push(label);
      }
    }
  }

  return {
    answer: buildAnswerText(parsed.data.claims),
    citations: orderedLabels.map((label) => {
      const item = evidenceByLabel.get(label)!;
      return {
        label,
        asset_id: item.result.asset_id,
        title: item.result.title,
        source_kind: "entry",
        snippet: item.result.snippet,
        citation_locator: item.result.citation_locator,
      };
    }),
    followUpSuggestions: parsed.data.follow_up_suggestions.length > 0
      ? parsed.data.follow_up_suggestions
      : buildAskFollowUpSuggestions("grounded", evidence.length),
  };
}
