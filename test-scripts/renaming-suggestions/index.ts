import { readFile } from "node:fs/promises";
import ollama from "ollama";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

async function runTest(maxCtxLines: number) {
  const RenameSchema = z.object({
    oldName: z
      .nullable(z.string())
      .describe(`The original name in the given code`),
    newName: z
      .nullable(z.string())
      .describe(`A new name for that symbol, if it is better than the old one`),
  });
  const OutputSchema = z.object({
    renames: z
      .array(RenameSchema)
      .describe(`A list of rename suggestions for the given code`),
  });

  const jsonSchema = zodToJsonSchema(OutputSchema);

  let promptVersion = `mk3.txt`;
  let promptTemplate = await readFile(`./prompts/${promptVersion}`, "utf-8");

  let sourceCode = await readFile(`./fixtures/extension.ts`, "utf8");
  let lines = sourceCode.split(`\n`);
  let lineCount = lines.length;
  let startLine = Math.floor(Math.random() * lineCount);
  // let endLine = startLine + Math.ceil(Math.random() * (lineCount - startLine));
  let endLine = startLine + maxCtxLines;
  let chunk = lines.slice(startLine, endLine);

  let [prefix, suffix] = promptTemplate
    .replace(`{{jsonSchema}}`, JSON.stringify(jsonSchema, null, 2))
    .replace(`{{source_code}}`, chunk.join(`\n`))
    .split(`[[MARKER]]`);
  // console.log(JSON.stringify(jsonSchema, null, 2));

  // console.log(`PREFIX\n${prefix}\n\nSUFFIX\n${suffix}\n\n`);
  let generationStream = await ollama.generate({
    model: `qwen2.5-coder:1.5b-instruct`,
    prompt: prefix,
    suffix,
    keep_alive: "30m",
    stream: true,
    // format: jsonSchema,
    options: {
      temperature: 0.2,
      stop: ["```"],
    },
    // system: `You are Qwen, an expert coding assistant.
    // You are running inside an IDE providing inline suggestions to the
    // user as he works.

    // ## Latest user events

    // `,
  });

  console.log(`{`);
  for await (const chunk of generationStream) {
    process.stdout.write(chunk.response);
  }
  console.log(`}`);
}

async function main() {
  for (let i = 0; i < 4; i++) {
    await runTest(200);
  }
}

main().catch((err) => console.error(err));
