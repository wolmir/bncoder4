import * as vscode from "vscode";
import { Ollama } from "ollama";
import zodToJsonSchema from "zod-to-json-schema";

export async function generateJson<T>(
  prompt: string,
  schema: any
): Promise<T | null> {
  let accumulatedResponse = ``;
  let parsingError = false;
  let retryCount = 0;

  let prefix = `USER:
${prompt}

Respond using JSON with the following schema:
${"```"}
${JSON.stringify(zodToJsonSchema(schema))}
${"```"}

ASSISTANT:
${"```"}json
{
    `;

  let suffix = `
}
${"```"}
`;

  do {
    parsingError = false;
    try {
      let client = new Ollama();
      let response = await client.generate({
        model: `qwen2.5-coder:1.5b-instruct`,
        prompt: prefix,
        suffix,
        keep_alive: "30m",
        stream: true,
        options: {
          temperature: 0,
          stop: ["```"],
        },
      });

      for await (const chunk of response) {
        accumulatedResponse += chunk.response;
      }
    } catch (err) {
      return null;
    }

    accumulatedResponse = `{${accumulatedResponse}}`;

    try {
      let result = JSON.parse(accumulatedResponse);
      return result;
    } catch (err) {
      parsingError = true;
      retryCount += 1;
      accumulatedResponse = ``;
    }
  } while (parsingError && retryCount < 3);

  return null;
}
