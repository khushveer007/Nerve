import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { bootstrapDatabase } from "../db.js";
import { runRagMigrations } from "../rag/db.js";
import { enqueueEntryBackfill, startKnowledgeWorkerLoop } from "../rag/jobs.js";

function isMainModule() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function startRagWorker() {
  await bootstrapDatabase();

  const abortController = new AbortController();
  const stopWorker = () => {
    abortController.abort();
  };

  process.on("SIGINT", stopWorker);
  process.on("SIGTERM", stopWorker);

  if (!config.assistant.enabled) {
    console.log("Assistant RAG is disabled in this environment; worker is idling.");
    while (!abortController.signal.aborted) {
      await delay(1_000);
    }
    return;
  }

  await runRagMigrations();
  await enqueueEntryBackfill();

  await startKnowledgeWorkerLoop({ signal: abortController.signal });
}

if (isMainModule()) {
  startRagWorker().catch((error) => {
    console.error("Failed to start RAG worker", error);
    process.exit(1);
  });
}
