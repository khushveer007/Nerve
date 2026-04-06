import { config } from "../config.js";

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

function serializeEmbedding(embedding: number[] | null) {
  return embedding ? JSON.stringify(embedding) : null;
}

async function requestEmbeddings(texts: string[]) {
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

  return payload.data.map((item) => {
    if (!Array.isArray(item.embedding)) {
      throw new Error("Embedding response payload was invalid.");
    }

    if (item.embedding.length !== config.assistant.embeddings.dimensions) {
      throw new Error("Embedding response dimensions did not match the configured schema.");
    }

    return item.embedding;
  });
}

export function embeddingsEnabled() {
  return Boolean(config.assistant.embeddings.url);
}

export async function embedTexts(texts: string[]) {
  const embeddings = await requestEmbeddings(texts);
  return embeddings.map(serializeEmbedding);
}

export async function embedQueryText(text: string) {
  const [embedding] = await requestEmbeddings([text]);
  return serializeEmbedding(embedding);
}
