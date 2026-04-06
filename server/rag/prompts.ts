export interface GroundedAnswerPromptEvidence {
  label: string;
  title: string;
  snippet: string;
  excerpt: string;
  department: string;
  entryDate: string;
  authorName: string;
  citationPath: string[];
}

export function buildGroundedAnswerMessages(question: string, evidence: GroundedAnswerPromptEvidence[]) {
  const serializedEvidence = evidence.map((item) => [
    `${item.label}: ${item.title}`,
    `Department: ${item.department}`,
    `Entry date: ${item.entryDate}`,
    `Author: ${item.authorName || "Unknown"}`,
    `Heading path: ${item.citationPath.join(" > ") || "Entry overview"}`,
    `Snippet: ${item.snippet}`,
    `Excerpt: ${item.excerpt}`,
  ].join("\n")).join("\n\n");

  return [
    {
      role: "system",
      content: [
        "You are a grounded answer generator for the Nerve assistant.",
        "Use only the supplied evidence.",
        "Do not add facts, background knowledge, or speculation.",
        "Return valid JSON with this shape:",
        "{",
        '  "claims": [{ "text": "string", "citations": ["S1"] }],',
        '  "follow_up_suggestions": ["string"]',
        "}",
        "Rules:",
        "- Provide 1 to 3 concise claims.",
        "- Every claim must cite one or more evidence labels.",
        "- Only cite labels that were supplied in the evidence list.",
        "- Keep follow-up suggestions short and practical.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Question: ${question}`,
        "",
        "Evidence:",
        serializedEvidence,
      ].join("\n"),
    },
  ];
}
