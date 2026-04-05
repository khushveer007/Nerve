import { createHash } from "node:crypto";
import type { Entry } from "../db.js";
import type { ChunkSeed, EntryChunkDocument, EntryKnowledgeMetadata } from "./types.js";

function normalizeText(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatMetadataValue(value: number | string | string[] | null) {
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "";
  if (value === null) return "";
  return String(value).trim();
}

function buildMetadataLines(entry: Entry) {
  const metadataPairs: Array<[string, number | string | string[] | null]> = [
    ["Department", entry.dept],
    ["Type", entry.type],
    ["Priority", entry.priority],
    ["Entry date", entry.entry_date],
    ["Tags", entry.tags],
    ["Academic year", entry.academic_year],
    ["Author", entry.author_name],
    ["Created by", entry.created_by],
    ["Student count", entry.student_count],
    ["External link", entry.external_link],
    ["Collaborating organisation", entry.collaborating_org],
  ];

  return metadataPairs
    .map(([label, value]) => [label, formatMetadataValue(value)] as const)
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}: ${value}`);
}

function splitIntoParagraphSections(body: string) {
  const normalizedBody = normalizeText(body);
  if (!normalizedBody) return ["No entry body was provided."];

  const rawSections = normalizedBody
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (rawSections.length <= 1) return rawSections;

  const groupedSections: string[] = [];
  let current = "";

  for (const section of rawSections) {
    const nextValue = current ? `${current}\n\n${section}` : section;
    if (nextValue.length <= 900 || current.length === 0) {
      current = nextValue;
      continue;
    }

    groupedSections.push(current);
    current = section;
  }

  if (current) groupedSections.push(current);
  return groupedSections;
}

function countTokens(content: string) {
  return content
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .length;
}

export function buildEntryKnowledgeMetadata(entry: Entry): EntryKnowledgeMetadata {
  return {
    source_kind: "entry",
    entry_id: entry.id,
    dept: entry.dept,
    type: entry.type,
    tags: entry.tags,
    entry_date: entry.entry_date,
    academic_year: entry.academic_year,
    author_name: entry.author_name,
    created_by: entry.created_by,
    priority: entry.priority,
    student_count: entry.student_count,
    external_link: entry.external_link,
    collaborating_org: entry.collaborating_org,
  };
}

export function buildEntryChunkDocument(entry: Entry): EntryChunkDocument {
  const metadata = buildEntryKnowledgeMetadata(entry);
  const metadataLines = buildMetadataLines(entry);
  const bodySections = splitIntoParagraphSections(entry.body);

  const markdownLines = [`# ${entry.title}`, ""];
  if (metadataLines.length > 0) {
    markdownLines.push("## Entry metadata", "");
    for (const line of metadataLines) {
      markdownLines.push(`- ${line}`);
    }
    markdownLines.push("");
  }
  markdownLines.push("## Body", "", ...bodySections);

  const leadingSummary = [`Title: ${entry.title}`, ...metadataLines].join("\n");
  const chunks: ChunkSeed[] = [];
  let cursor = 0;

  bodySections.forEach((section, index) => {
    const content = index === 0
      ? `${leadingSummary}\n\n${section}`.trim()
      : section;
    const charStart = cursor;
    const charEnd = cursor + content.length;
    const headingPath = index === 0 ? ["Entry overview"] : [`Section ${index + 1}`];

    chunks.push({
      chunk_no: index + 1,
      chunk_type: "body",
      heading_path: headingPath,
      char_start: charStart,
      char_end: charEnd,
      token_count: countTokens(content),
      content,
      metadata: {
        ...metadata,
        title: entry.title,
        chunk_role: index === 0 ? "overview" : "body",
      },
      citation_locator: {
        source_kind: "entry",
        page_from: null,
        page_to: null,
        heading_path: headingPath,
        char_start: charStart,
        char_end: charEnd,
      },
    });

    cursor = charEnd + 2;
  });

  const normalizedText = chunks.map((chunk) => chunk.content).join("\n\n");
  const sourceHash = createHash("sha256")
    .update(JSON.stringify({
      title: entry.title,
      dept: entry.dept,
      type: entry.type,
      body: normalizeText(entry.body),
      priority: entry.priority,
      entry_date: entry.entry_date,
      created_by: entry.created_by,
      tags: entry.tags,
      author_name: entry.author_name,
      academic_year: entry.academic_year,
      student_count: entry.student_count,
      external_link: entry.external_link,
      collaborating_org: entry.collaborating_org,
    }))
    .digest("hex");

  return {
    metadata,
    normalized_markdown: markdownLines.join("\n").trim(),
    normalized_text: normalizedText,
    structural_metadata: {
      source_kind: "entry",
      section_count: bodySections.length,
      chunk_count: chunks.length,
      metadata_lines: metadataLines.length,
    },
    source_hash: sourceHash,
    chunks,
  };
}
