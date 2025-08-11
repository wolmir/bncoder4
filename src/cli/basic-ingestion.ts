import { Ollama, OllamaEmbedding } from "@llamaindex/ollama";
import {
  Document,
  IngestionPipeline,
  KeywordExtractor,
  SentenceSplitter,
  TextSplitter,
  VectorStoreIndex,
  Settings,
  SummaryExtractor,
  QuestionsAnsweredExtractor,
} from "llamaindex";
import fs from "node:fs/promises";

export class BenitoTextSplitter extends TextSplitter {
  constructor(
    private options: {
      numberOfLines: number;
      linesOverlap: number;
      maxTokens: number;
    }
  ) {
    super();
  }

  private lineBlockGenerator(text: string) {
    let nLines = this.options.numberOfLines;
    let lines = text.split(/\r\n|\r|\n/);
    let currentLine = 0;
    let generator: IterableIterator<string[], string[], string[]> = {
      next: (): IteratorResult<string[]> => {
        let done = currentLine >= lines.length;
        let value: string[] = done
          ? []
          : lines.slice(currentLine, currentLine + nLines);

        currentLine += nLines - this.options.linesOverlap;

        return {
          done,
          value,
        };
      },
      [Symbol.iterator]: function (): IterableIterator<string[], any, any> {
        return this;
      },
    };

    return generator;
  }

  splitText(text: string): string[] {
    let blocksIter = this.lineBlockGenerator(text);
    let textChunks: string[] = [];
    let { done, value } = blocksIter.next();
    while (!done) {
      let chunk = value.join(`\n`);
      if (chunk.length >= this.options.maxTokens * 4) {
        chunk = chunk.slice(0, this.options.maxTokens * 4);
      }
      textChunks.push(chunk);
    }
    return textChunks;
  }
}

async function main() {
  Settings.llm = new Ollama({
    model: `qwen2.5-coder:1.5b-instruct`,
    options: {
      num_ctx: 16384,
    },
  });
  // Load essay from abramov.txt in Node
  const path = "../node_modules/llamaindex/examples/abramov.txt";

  const essay = await fs.readFile(path, "utf-8");

  // Create Document object with essay
  const document = new Document({ text: essay, id_: path });
  const pipeline = new IngestionPipeline({
    transformations: [
      new BenitoTextSplitter({
        numberOfLines: 100,
        linesOverlap: 20,
        maxTokens: 8192,
      }),
      new KeywordExtractor({
        keywords: 10,
      }),
      new SummaryExtractor({}),
      new QuestionsAnsweredExtractor({
        questions: 5,
      }),
      new OllamaEmbedding({
        model: `snowflake-arctic-embed2`,
        options: {
          num_ctx: 8192,
        },
      }),
    ],
  });
  console.time("Pipeline Run Time");

  const nodes = await pipeline.run({ documents: [document] });

  console.timeEnd("Pipeline Run Time");

  // initialize the VectorStoreIndex from nodes
  const index = await VectorStoreIndex.init({ nodes });

  // Query the index
  const queryEngine = index.asQueryEngine();

  const { message } = await queryEngine.query({
    query: "summarize the article in three sentence",
  });

  console.log(message);
}

main().catch(console.error);
