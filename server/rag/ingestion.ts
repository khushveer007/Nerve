import { config } from "../config.js";
import type { Entry } from "../db.js";
import { buildEntryChunkDocument } from "./chunking.js";
import { storeIndexedEntryVersion, upsertEntryKnowledgeAsset } from "./db.js";
import { embedTexts } from "./embeddings.js";

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
