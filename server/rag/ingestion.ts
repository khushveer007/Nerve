import { config } from "../config.js";
import type { Entry } from "../db.js";
import { buildEntryChunkDocument } from "./chunking.js";
import { storeIndexedEntryVersion, upsertEntryKnowledgeAsset } from "./db.js";

function buildEmbeddingHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.assistant.embeddings.apiKey && config.assistant.embeddings.authHeader) {
    headers[config.assistant.embeddings.authHeader] = config.assistant.embeddings.authScheme
      ? `${config.assistant.embeddings.authScheme} ${config.assistant.embeddings.apiKey}`
      : config.assistant.embeddings.apiKey;
  }

  return headers;
}

async function embedTexts(texts: string[]) {
  if (!config.assistant.embeddings.url) {
    return texts.map(() => null);
  }

  const response = await fetch(config.assistant.embeddings.url, {
    method: "POST",
    headers: buildEmbeddingHeaders(),
    body: JSON.stringify({
      model: config.assistant.embeddings.model,
      input: texts,
      dimensions: config.assistant.embeddings.dimensions,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed with status ${response.status}.`);
  }

  const payload = await response.json() as {
    data?: Array<{ embedding?: number[] }>;
  };

  if (!Array.isArray(payload.data) || payload.data.length !== texts.length) {
    throw new Error("Embedding response payload was invalid.");
  }

  return payload.data.map((item) => (
    Array.isArray(item.embedding) ? JSON.stringify(item.embedding) : null
  ));
}

export async function indexEntryAsset(entry: Entry) {
  const asset = await upsertEntryKnowledgeAsset(entry);
  const document = buildEntryChunkDocument(entry);
  const embeddings = await embedTexts(document.chunks.map((chunk) => chunk.content));

  const stored = await storeIndexedEntryVersion({
    asset,
    document,
    embeddings,
    extractorModel: config.assistant.embeddings.url
      ? config.assistant.embeddings.model
      : "entry-phase-1",
  });

  return {
    asset_id: asset.id,
    ...stored,
  };
}
