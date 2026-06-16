import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";

/**
 * Local, free embeddings powered by transformers.js (@huggingface/transformers).
 *
 * The model runs entirely on the server machine — no API key, no network calls
 * after the first download (the model is cached on disk). This keeps the whole
 * RAG pipeline free.
 *
 * Default model: Xenova/all-MiniLM-L6-v2 (384-dim, fast, solid quality).
 */
export class LocalEmbeddings extends Embeddings {
  private modelName: string;
  // The transformers.js pipeline is lazily created once and reused.
  private extractorPromise: Promise<any> | null = null;

  constructor(
    fields?: EmbeddingsParams & { model?: string }
  ) {
    super(fields ?? {});
    this.modelName =
      fields?.model ||
      process.env.EMBEDDING_MODEL ||
      "Xenova/all-MiniLM-L6-v2";
  }

  private async getExtractor() {
    if (!this.extractorPromise) {
      // Dynamic import keeps this Node-only dependency out of the client bundle.
      this.extractorPromise = import("@huggingface/transformers").then(
        ({ pipeline }) => pipeline("feature-extraction", this.modelName)
      );
    }
    return this.extractorPromise;
  }

  /** Embed a batch of documents. */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const extractor = await this.getExtractor();
    const vectors: number[][] = [];
    // Process sequentially to keep memory predictable for large PDFs.
    for (const text of texts) {
      const output = await extractor(text, {
        pooling: "mean",
        normalize: true,
      });
      vectors.push(Array.from(output.data as Float32Array));
    }
    return vectors;
  }

  /** Embed a single query string. */
  async embedQuery(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data as Float32Array);
  }
}
